const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const path = require("path");

process.env.JWT_SECRET = "test_secret_key_that_is_at_least_32_chars_long_here";
process.env.UPLOAD_DIR = path.join(__dirname, "..", "test_uploads");

const app = require("../server");
const db = require("../config/db");
const { _resetStore } = require("../middleware/rateLimit");

let server;
let port;
let baseUrl;

function fetchJson(method, urlPath, options = {}) {
    return new Promise((resolve, reject) => {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        const req = http.request(baseUrl + urlPath, {
            method: method,
            headers: headers,
            timeout: 5000
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch (e) { parsed = null; }
                resolve({ status: res.statusCode, body: parsed, raw: data, headers: res.headers });
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

describe("Server endpoints", () => {
    before(() => {
        _resetStore();
        server = app.listen(0);
        port = server.address().port;
        baseUrl = `http://localhost:${port}`;
    });

    after(() => {
        if (server) server.close();
        db.end(() => {});
    });

    it("GET / should return the SPA shell or the running message", async () => {
        const res = await fetchJson("GET", "/");
        assert.strictEqual(res.status, 200);
        const type = res.headers["content-type"] || "";
        if (type.includes("text/html")) {
            assert.ok(res.raw.includes('id="root"'), "expected the SPA shell");
        } else {
            assert.strictEqual(res.body.message, "MarketplaceOS API is running");
        }
    });

    it("unknown non-API routes must not fall through to index.html", async () => {
        const res = await fetchJson("GET", "/uploads/does-not-exist.png");
        assert.strictEqual(res.status, 404);
    });

    it("must allow its own origin so the served SPA can load", async () => {
        // The browser sends Origin for the app's module script when the backend
        // serves the built frontend. Refusing it blocks the UI and renders a
        // blank page, so same-origin requests must always be allowed.
        const res = await fetchJson("GET", "/health", {
            headers: { Origin: baseUrl }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(
            res.headers["access-control-allow-origin"],
            baseUrl,
            "same-origin requests must be allowed"
        );
    });

    it("must not send CORS headers for an unlisted origin", async () => {
        const res = await fetchJson("GET", "/health", {
            headers: { Origin: "https://evil.example" }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(
            res.headers["access-control-allow-origin"],
            undefined,
            "an unlisted origin must not be reflected"
        );
    });

    it("GET /health should return ok status", async () => {
        const res = await fetchJson("GET", "/health");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, "ok");
        assert.ok(res.body.timestamp);
    });

    it("GET /api/unknown should return 404", async () => {
        const res = await fetchJson("GET", "/api/unknown");
        assert.strictEqual(res.status, 404);
        assert.ok(res.body.message.includes("not found"));
    });

    it("POST /api/auth/login with missing fields should return 400", async () => {
        const res = await fetchJson("POST", "/api/auth/login", { body: {} });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.includes("required"));
    });

    it("POST /api/auth/register with admin role should be rejected", async () => {
        const res = await fetchJson("POST", "/api/auth/register", {
            body: { name: "Admin", email: "admin@example.com", password: "password123", role: "admin" }
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.toLowerCase().includes("admin"));
    });

    it("POST /api/auth/register with short password should be rejected", async () => {
        const res = await fetchJson("POST", "/api/auth/register", {
            body: { name: "Test User", email: "test@example.com", password: "12345", role: "customer" }
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.message.toLowerCase().includes("password"));
    });

    it("GET /api/auth/me without token should return 401", async () => {
        const res = await fetchJson("GET", "/api/auth/me");
        assert.strictEqual(res.status, 401);
    });

    it("GET /api/categories should not leak internal error details on 500", async () => {
        const res = await fetchJson("GET", "/api/categories");
        assert.ok(res.status === 200 || res.status === 500);
        if (res.status === 500 && res.body) {
            assert.strictEqual(res.body.message, "Failed to fetch categories");
            assert.strictEqual(res.body.error, undefined);
        }
    });

    it("GET /api/products should not leak internal error details on 500", async () => {
        const res = await fetchJson("GET", "/api/products");
        assert.ok(res.status === 200 || res.status === 500);
        if (res.status === 500 && res.body) {
            assert.strictEqual(res.body.message, "Failed to fetch products");
            assert.strictEqual(res.body.error, undefined);
        }
    });
});
