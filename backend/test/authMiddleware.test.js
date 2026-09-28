const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test_secret_key_that_is_at_least_32_chars_long_here";

const {
    authenticateToken,
    authorizeRoles,
    requireJwtSecret,
    generateAccessToken,
    signRefreshToken
} = require("../middleware/auth");

function mockResponse() {
    const res = { _status: 200, _body: null, _headers: {} };
    res.status = (code) => { res._status = code; return res; };
    res.json = (data) => { res._body = data; return res; };
    res.set = (key, value) => { res._headers[key] = value; return res; };
    return res;
}

describe("requireJwtSecret", () => {
    it("should throw when JWT_SECRET is too short", () => {
        const original = process.env.JWT_SECRET;
        process.env.JWT_SECRET = "short";
        assert.throws(() => requireJwtSecret(), /32/);
        process.env.JWT_SECRET = original;
    });

    it("should return the secret when it is long enough", () => {
        const original = process.env.JWT_SECRET;
        process.env.JWT_SECRET = "a_very_long_and_secure_secret_value_1234567890";
        assert.strictEqual(requireJwtSecret(), process.env.JWT_SECRET);
        process.env.JWT_SECRET = original;
    });
});

describe("generateAccessToken", () => {
    it("should produce a signed JWT with user payload", () => {
        const token = generateAccessToken({
            id: 1,
            name: "Test",
            email: "test@example.com",
            role: "customer"
        });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        assert.strictEqual(decoded.id, 1);
        assert.strictEqual(decoded.role, "customer");
    });
});

describe("authenticateToken", () => {
    it("should reject requests with no authorization header", () => {
        const req = { headers: {} };
        const res = mockResponse();
        let nextCalled = false;
        authenticateToken(req, res, () => { nextCalled = true; });
        assert.strictEqual(res._status, 401);
        assert.strictEqual(nextCalled, false);
        assert.ok(res._body.message.includes("required"));
    });

    it("should reject requests with malformed authorization header", () => {
        const req = { headers: { authorization: "BearerToken" } };
        const res = mockResponse();
        authenticateToken(req, res, () => {});
        assert.strictEqual(res._status, 401);
    });

    it("should reject an invalid token", () => {
        const req = { headers: { authorization: "Bearer garbage_token" } };
        const res = mockResponse();
        authenticateToken(req, res, () => {});
        assert.strictEqual(res._status, 401);
        assert.ok(res._body.message.includes("Invalid or expired"));
    });

    it("should accept a valid token", () => {
        const req = {
            headers: {
                authorization: "Bearer " + generateAccessToken({
                    id: 1, name: "Test", email: "t@e.com", role: "customer"
                })
            }
        };
        const res = mockResponse();
        let nextCalled = false;
        authenticateToken(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.user.id, 1);
        assert.strictEqual(req.user.role, "customer");
    });

    it("should return TOKEN_EXPIRED code on expired token", () => {
        const token = jwt.sign(
            { id: 1, role: "customer" },
            process.env.JWT_SECRET,
            { expiresIn: "1s" }
        );
        const req = { headers: { authorization: "Bearer " + token } };
        const res = mockResponse();

        setTimeout(() => {
            authenticateToken(req, res, () => {});
            assert.strictEqual(res._status, 401);
            assert.strictEqual(res._body.code, "TOKEN_EXPIRED");
        }, 1100);
    });
});

describe("authorizeRoles", () => {
    it("should allow when role matches", () => {
        const middleware = authorizeRoles("admin", "vendor");
        const req = { user: { role: "admin" } };
        const res = mockResponse();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    it("should deny when role does not match", () => {
        const middleware = authorizeRoles("admin");
        const req = { user: { role: "customer" } };
        const res = mockResponse();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(res._status, 403);
        assert.strictEqual(nextCalled, false);
    });

    it("should deny when no user is present", () => {
        const middleware = authorizeRoles("admin");
        const req = { user: null };
        const res = mockResponse();
        middleware(req, res, () => {});
        assert.strictEqual(res._status, 403);
    });
});
