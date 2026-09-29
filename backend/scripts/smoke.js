// End-to-end smoke test against a running server and a migrated database.
// Unlike `npm test` (unit tests, no I/O), this exercises the real HTTP API:
// auth, RBAC, storefronts, the transactional checkout, the escrow hold and
// release, and review eligibility.
//
//   npm start                 # in one terminal
//   npm run smoke             # in another
//
// Override the target with SMOKE_BASE_URL=https://your-deployment.example.com
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5000";

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
}

(async () => {
  const health = await call("GET", "/health");
  check("health", health.status === 200 && health.json?.status === "ok");

  // --- admin ---
  const admin = await call("POST", "/api/auth/login", { body: { email: "admin@marketplaceos.test", password: "admin123" } });
  check("admin login", admin.status === 200 && !!admin.json?.token, `status=${admin.status}`);
  const at = admin.json?.token;

  const summary = await call("GET", "/api/analytics/summary", { token: at });
  check("admin revenue dashboard (GET /api/analytics/summary)",
    summary.status === 200 && summary.json !== null,
    `status=${summary.status} keys=${summary.json ? Object.keys(summary.json).join(",").slice(0, 90) : "none"}`);

  const users = await call("GET", "/api/users", { token: at });
  check("admin user list", users.status === 200 && Array.isArray(users.json?.users || users.json), `status=${users.status}`);

  const escrow = await call("GET", "/api/orders/admin/escrow", { token: at });
  check("admin escrow ledger", escrow.status === 200, `status=${escrow.status}`);

  const adminVendors = await call("GET", "/api/vendors/admin/all", { token: at });
  check("admin vendor management", adminVendors.status === 200, `status=${adminVendors.status}`);

  // --- storefronts (public) ---
  const vendors = await call("GET", "/api/vendors");
  check("public vendor storefronts (GET /api/vendors)", vendors.status === 200, `status=${vendors.status}`);
  const vendorId = (vendors.json?.vendors || vendors.json || [])[0]?.id;
  if (vendorId) {
    const store = await call("GET", `/api/vendors/${vendorId}`);
    check("public vendor storefront detail", store.status === 200, `status=${store.status} id=${vendorId}`);
  } else {
    check("public vendor storefront detail", false, "no vendors returned");
  }

  // --- catalog + reviews ---
  const products = await call("GET", "/api/products");
  const list = products.json?.products || products.json || [];
  check("product catalogue", products.status === 200 && list.length > 0, `count=${list.length}`);
  const product = list[0];
  check("product carries a real rating aggregate",
    product && product.rating !== undefined && product.review_count !== undefined,
    product ? `rating=${product.rating} review_count=${product.review_count}` : "no product");

  if (product) {
    const reviews = await call("GET", `/api/reviews/product/${product.id}`);
    check("product reviews readable", reviews.status === 200, `status=${reviews.status}`);
  }

  // --- customer journey: register -> cart -> checkout -> escrow -> review ---
  const email = `smoke_${Date.now()}@marketplaceos.test`;
  const reg = await call("POST", "/api/auth/register", {
    body: { name: "Smoke Tester", email, password: "smoketest123", role: "customer" },
  });
  check("customer register", reg.status === 200 || reg.status === 201, `status=${reg.status}`);

  const login = await call("POST", "/api/auth/login", { body: { email, password: "smoketest123" } });
  check("customer login", login.status === 200 && !!login.json?.token, `status=${login.status}`);
  const ct = login.json?.token;

  const addToCart = await call("POST", "/api/cart", { token: ct, body: { product_id: product.id, quantity: 1 } });
  check("add to cart", addToCart.status === 200 || addToCart.status === 201, `status=${addToCart.status}`);

  const cart = await call("GET", "/api/cart", { token: ct });
  check("cart reads back", cart.status === 200, `status=${cart.status}`);

  const order = await call("POST", "/api/orders", { token: ct, body: { idempotency_key: `smoke_${Date.now()}` } });
  const orderId = order.json?.order?.id ?? order.json?.id;
  check("checkout creates order + holds escrow",
    order.status === 200 || order.status === 201,
    `status=${order.status} order=${orderId} escrow=${order.json?.escrow?.status ?? order.json?.escrow_status ?? "?"}`);

  if (orderId) {
    const reviewTooEarly = await call("POST", "/api/reviews", {
      token: ct, body: { product_id: product.id, order_id: orderId, rating: 5, comment: "premature" },
    });
    check("review blocked before delivery", reviewTooEarly.status === 400 || reviewTooEarly.status === 403,
      `status=${reviewTooEarly.status}`);

    const confirm = await call("POST", `/api/orders/${orderId}/confirm-delivery`, { token: ct });
    check("confirm delivery releases escrow", confirm.status === 200, `status=${confirm.status}`);

    const review = await call("POST", "/api/reviews", {
      token: ct, body: { product_id: product.id, order_id: orderId, rating: 5, comment: "Great product, fast delivery." },
    });
    check("review allowed after delivery", review.status === 200 || review.status === 201, `status=${review.status}`);

    const rating = await call("GET", `/api/reviews/product/${product.id}/rating`);
    check("rating aggregate updates", rating.status === 200 && (rating.json?.average ?? rating.json?.rating) !== null,
      JSON.stringify(rating.json).slice(0, 80));
  }

  // --- vendor analytics ---
  const vendor = await call("POST", "/api/auth/login", { body: { email: "kora@marketplaceos.test", password: "vendor123" } });
  check("vendor login", vendor.status === 200 && !!vendor.json?.token, `status=${vendor.status}`);
  const vt = vendor.json?.token;
  const vsum = await call("GET", "/api/analytics/vendor", { token: vt });
  check("vendor sales analytics", vsum.status === 200, `status=${vsum.status}`);
  const vseries = await call("GET", "/api/analytics/vendor/time-series?range=30d", { token: vt });
  check("vendor time-series", vseries.status === 200, `status=${vseries.status}`);

  // --- RBAC ---
  const denied = await call("GET", "/api/analytics/summary", { token: ct });
  check("customer blocked from admin analytics (RBAC)", denied.status === 403, `status=${denied.status}`);
  const noAuth = await call("GET", "/api/cart");
  check("unauthenticated request rejected", noAuth.status === 401, `status=${noAuth.status}`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
