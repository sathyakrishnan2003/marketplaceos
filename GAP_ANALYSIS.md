# MarketplaceOS — Gap Analysis (Existing Project vs. Capstone Acceptance Criteria)

**Reviewed:** Existing `backend/` + `frontend/` in `cynaris-project`
**Reference:** Capstone brief "MarketplaceOS — Full Stack Development Intern" (5 milestones, acceptance criteria)
**Note:** The three provided data packs (`fullstack_requirements.txt`, `fullstack_db_schema.sql`, `fullstack_wireframes.txt`) are **not present on disk** in this workspace, so this analysis maps against the brief's written acceptance criteria and the in-repo `TECHNICAL_DESIGN_DOCUMENT.md`. If the packs specify different fields/flows, the schema and endpoints should be re-checked against them.

---

## 1. Status at a glance

| # | Acceptance criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | Multi-vendor with storefronts | 🟠 Partial | Data model is multi-vendor; **no storefront page / public vendor profile** |
| 2 | Escrow flow (sandbox) | 🟠 Partial | Escrow states + release exist, but **fully simulated — no Razorpay/payment sandbox**, no refund, no payout |
| 3 | Review / rating system | 🟠 Partial | API exists; **no UI to write or read reviews**, product ratings are hardcoded |
| 4 | Vendor sales analytics | 🟠 Partial | 4 summary numbers only; **no charts, no per-product, no time-series** |
| 5 | Super-admin revenue dashboard | 🟠 Partial | API exists but **unreachable — no admin account can be created or logged in**; chart/activity are hardcoded |
| 6 | Mobile responsive | 🟢 Mostly present | `@media` queries in `App.css`, `customer.css`, `workspace.css` — needs visual QA |

**Overall:** roughly a **functional prototype / skeleton (~35–45% of the capstone)**. The happy path (browse → cart → order → escrow held → confirm → release) works end-to-end at the API level, but several criteria are only partially wired and a large amount of scaffolding (dead files, empty controllers, template leftovers) remains.

---

## 2. What actually works today

**Backend (real logic):**
- `authController`: register (customer/vendor only) + login (bcrypt + JWT) + `me`.
- `productController`: list active products, get one, create vendor product (multipart image via multer), list vendor's own products.
- `cartController`: get / add-or-increment (stock-checked) / remove.
- `orderController`: **atomic transactional checkout** — locks cart rows (`FOR UPDATE`), checks stock, computes total server-side, inserts order + order_items, creates `held` escrow row, decrements stock, clears cart, commits/rolls back.
- `confirmDelivery`: releases escrow only for the order owner and only when `held` (idempotent).
- `reviewController`: list reviews per product; create review gated on a **delivered** purchase; blocks duplicates.
- `analyticsController`: admin `getSummary` (GMV, orders, escrow, vendors, top vendors) and vendor `getVendorSummary` (revenue, orders, units, active products, escrow).
- `categoryController`: list categories.
- Auth middleware with `authenticateToken` + `authorizeRoles` (RBAC groundwork present).

**Frontend (real, working):**
- Login / Register with JWT session persistence (`utils/auth.js`, `services/api.js` bearer token).
- Role-aware shells: customer shop, vendor/admin workspace.
- Customer shop: hero, category filters, client-side search, cart drawer, checkout, orders list with "Confirm delivery".
- Vendor/admin: metric cards fed by analytics APIs; catalog grid; "Add product" form with categories + image upload.
- Toasts/notices; responsive layouts.

**Schema:** matches the flow (users, vendors, categories, products, cart_items, orders, order_items, escrow_transactions, reviews) with FKs, unique constraints, soft-deletes, and seed categories.

---

## 3. Critical gaps (blockers)

### 3.1 Super-admin dashboard is unreachable
- `authController.register` forces role to `customer` or `vendor` — **admin can never be created** via the app.
- `Login.jsx` offers only "Preview as customer" and "Preview as vendor" demo buttons — **no admin demo**.
- `GET /api/analytics/summary` requires `admin`, so the entire "super-admin revenue dashboard" criterion **cannot be reached by any user**. Needs: admin seed/provisioning (or promoted user), and an admin entry point.

### 3.2 Review / rating criterion has no user-facing side
- No review form and no review list anywhere in the UI.
- `frontend/src/pages/ProductDetails.jsx` is **empty** — there is no product detail view, which is where reviews/ratings/assets belong.
- Product cards show **hardcoded** `rating: 4.8` and `sales: 0` (`App.jsx`), not aggregates computed from the `reviews` table. No product rating aggregate endpoint or column is exposed.
- `getProductReviews`/`createReview` exist in `services/api.js` but are **never called** by any component.

### 3.3 No vendor storefront / public vendor profile
- Customers cannot open a vendor's store. There is **no** `GET /api/vendors/:id` or `/api/vendors`, no "visit store" link, no storefront page.
- "Storefront" currently means only the vendor's own workspace product list. The criterion "multi-vendor **with storefronts**" is unmet on the customer side.

### 3.4 Escrow is entirely simulated — no payment sandbox
- `razorpay` is a listed skill and the criterion says "escrow flow (**sandbox**)", but **no payment gateway is integrated** (no razorpay/Stripe dependency, no order/capture/refund/webhook endpoints, no signature verification). `escrow_transactions` is written straight to `held` on checkout.
- `refunded` exists in the enum but **no refund path** exists.
- No vendor **payout** step, no escrow release audit trail, no admin escrow override/dispute handling.

---

## 4. Missing features vs. criteria (detailed)

### 4.1 Multi-vendor & storefronts
- [ ] Public vendor profile endpoint + vendor storefront page/route.
- [ ] Vendor approval workflow — `vendors.status` defaults to `approved`; there is **no pending/approve/suspend UI or endpoint** (`Vendors.jsx` is empty).
- [ ] Vendor business name is not collected at registration (it reuses the user `name`).
- [ ] Category management is read-only (no admin CRUD, though `TECHNICAL_DESIGN_DOCUMENT.md` implies catalog management).
- [ ] No `react-router-dom` usage at all (installed but unused) — no URLs, deep links, or `/vendor/:id`, `/product/:id` routes; navigation is pure conditional state in `App.jsx`.

### 4.2 Orders / fulfillment
- Order status `shipped` is **never set** — no vendor "mark shipped" action, no admin order management.
- No vendor-facing order view to fulfill (vendor only sees aggregate counts).
- `Orders.jsx`, `Vendors.jsx`, `Users.jsx`, `Escrow.jsx`, `Dashboard.jsx` pages are **empty** (dead files).
- No order detail view, no cancellation, no refund flow, no shipping/tracking fields.

### 4.3 Reviews & ratings
- [ ] Review write/read UI (product detail page).
- [ ] Aggregate rating on `products` (avg + count) exposed in listings and detail.
- [ ] Vendor reply to reviews (nice-to-have, not in brief).
- [ ] Pagination for reviews.

### 4.4 Analytics
- [ ] Real charts (frontend SVG is a **hardcoded static path**, not bound to data).
- [ ] Time-range filters are cosmetic (`<select>` with no handler).
- [ ] Vendor per-product breakdown, units over time, low-stock, top products.
- [ ] Admin: revenue by category/vendor over time, payout vs. held escrow trend.
- [ ] Export/download (not required but expected in "revenue dashboard").

### 4.5 Platform / admin
- [ ] Admin user management (`routes/users.js` only lists users; **no suspend/role-change** endpoints; `userController.js` is empty).
- [ ] Admin escrow ledger view / manual release / refund.
- [ ] Reports & exports.

---

## 5. Engineering quality gaps

**Dead / empty / placeholder files (must clean up):**
- Empty backend files: `middleware/upload.js` (upload config lives inline in `routes/products.js`), `controllers/userController.js`, `controllers/recordController.js`, `utils/email.js` (nodemailer installed but unused — no email verification/password reset/order emails), `backend/.env.example`.
- Empty frontend files: `pages/Cart.jsx`, `pages/Orders.jsx`, `pages/Products.jsx`, `pages/ProductDetails.jsx`, `pages/Escrow.jsx`, `pages/Users.jsx`, `pages/Vendors.jsx`, `pages/Dashboard.jsx`, `components/Navbar.jsx`, `components/Sidebar.jsx`.
- **Template leftovers from a different project ("Cynaris"):** `components/Dashboard.jsx` renders a "Cynaris Management System" with `localStorage` keys `token`/`user` (not the app's `marketplace_token`/`marketplace_user`). `routes/records.js` + `recordController.js` reference a `records` table that **does not exist in `schema.sql`**. `routes/records.js` is also **not mounted** in `server.js`.
- `New folder/` is empty.

**Security / production readiness (from the project's own TDD §5):**
- [ ] `app.use(cors())` — **wide open**, TDD says restrict to the deployed origin.
- [ ] JWT has no refresh-token flow; secret is committed in `backend/.env` (and `JWT_SECRET` is a plaintext weak value).
- [ ] No rate limiting on `/api/auth/*` (brute-force risk).
- [ ] No input-validation layer (email format, price/stock bounds, review length) — validation is ad-hoc per controller.
- [ ] No central error handling for unhandled async errors (Express 5 handles promise rejection, but controllers return raw `error.message` in some paths).
- [ ] No HTTPS / secure cookies; token stored in `localStorage` (XSS exposure).
- [ ] Uploads stored on local disk under `backend/uploads/` and served statically; multer destination is a **relative path** (`"uploads/"`) so it depends on the process CWD.
- [ ] No structured logs, monitoring, or audit trail for escrow/order state changes.

**Testing & tooling:**
- [ ] **No tests anywhere.** `backend/package.json` test script is `echo "Error: no test specified" && exit 1`. Acceptance/quality bar requires at least API tests for business logic (checkout, escrow release, review eligibility).
- [ ] **No git repository** (`.git` absent) and no root `.gitignore`; the brief requires "on GitHub from Day 1".
- [ ] No root `README.md` with setup instructions (`frontend/README.md` is the Vite default).
- [ ] No seed/fixtures beyond 5 categories (no demo vendors/products/users).
- [ ] No deployment config for Railway (no `Procfile`/`Dockerfile`/build start script for the API); `backend` has no `.env.example`.
- [ ] Frontend `vite.config.js` has no API proxy and no build-time env template (`VITE_API_URL` is read but undocumented).

---

## 6. Data / consistency issues

- **Hardcoded catalog in `App.jsx`**: 12 demo products are merged with API products (`combined = [...data, ...products.filter(...)]`). Real ratings/sales are faked. This makes the vendor/admin catalog show non-existent products and needs to be removed once the DB is seeded.
- **Dual cart state**: a local `cart` array and the server cart are both maintained; `checkout()` falls back to a fake `DEMO-x` order when unauthenticated, mixing demo and real data.
- **"Orders" nav** in the workspace calls `notify('Your orders are coming soon')` for customers but loads real orders for vendors/admins — inconsistent.
- Product images uploaded by vendors are **not rendered** in the workspace catalog grid (`App.jsx` shows only a category glyph there), though the customer shop does render them.
- Analytics/counts fall back to hardcoded literals (e.g. `|| 1284560`, `|| 48`, `|| 342180`) when the API returns nothing — masks failures and shows fake numbers.

---

## 7. Prioritized remediation plan

**P0 — make the criteria reachable (blocks sign-off)**
1. Admin provisioning: seed/allow a super-admin, add an admin login/demo entry, verify `GET /api/analytics/summary` renders a **real super-admin revenue dashboard**.
2. Reviews UI: build `ProductDetails.jsx` with `getProductReviews` + review form (`createReview`), and add a product ratings aggregate (avg/count) to `products` + listings.
3. Vendor storefront: `GET /api/vendors` + `GET /api/vendors/:id` and a public storefront page; add "visit store" links from products.
4. Wire real charts to the analytics APIs; remove hardcoded sales/activity numbers.

**P1 — escrow sandbox & orders**
5. Razorpay test/sandbox integration (create order → capture → webhook → escrow held), keep simulated mode as fallback; add refund + vendor payout; audit escrow transitions.
6. Vendor/admin order management: mark shipped/delivered, order detail, admin ledger/release/refund.
7. Vendor approval workflow (pending → approved/suspended) + admin vendor management UI.

**P2 — platform & quality**
8. User management endpoints (suspend, role change) + UI; category CRUD.
9. Delete dead/empty/leftover files (§5); align `records.js`/`Dashboard.jsx` or remove.
10. Harden: restrict CORS, rate-limit auth, add validation layer, move secrets out of `.env`, add `.env.example`.
11. Tests (Jest/Supertest or Vitest) for auth, checkout transaction, escrow release, review eligibility, analytics; wire `npm test`.
12. Init git + root `.gitignore` + root `README.md` + seed script + Railway deploy config.
13. Verify against the three provided data packs once available (schema fields, wireframes, requirement coverage).

---

## 8. Verdict

The project is a **well-structured prototype**, not a finished capstone. The strongest parts (transactional checkout, escrow state model, RBAC middleware, role-aware UI, responsive CSS) are the hard parts and they exist. What's missing is mostly **breadth and wiring**: the super-admin dashboard is unreachable, reviews and storefronts have no customer UI, escrow has no real/sandbox payment provider, orders lack fulfillment, and there are no tests, git history, seed data, or deployment setup. Closing P0–P2 above maps the project onto all six acceptance criteria.
