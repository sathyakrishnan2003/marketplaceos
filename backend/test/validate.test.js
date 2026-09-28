const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
    validateRegistration,
    validateLogin,
    validateProduct,
    validateCategory,
    validateReview,
    validateUserStatus,
    validateUserRole
} = require("../middleware/validate");

function mockResponse() {
    const res = { _status: 200, _body: null };
    res.status = (code) => { res._status = code; return res; };
    res.json = (data) => { res._body = data; return res; };
    return res;
}

describe("validateRegistration", () => {
    it("should reject when name is too short", () => {
        const req = { body: { name: "A", email: "a@b.com", password: "secret123" } };
        const res = mockResponse();
        validateRegistration(req, res, () => {});
        assert.strictEqual(res._status, 400);
        assert.ok(res._body.message.includes("Name"));
    });

    it("should reject invalid email", () => {
        const req = { body: { name: "John", email: "not-an-email", password: "secret123" } };
        const res = mockResponse();
        validateRegistration(req, res, () => {});
        assert.strictEqual(res._status, 400);
        assert.ok(res._body.message.includes("email"));
    });

    it("should reject password shorter than 6 chars", () => {
        const req = { body: { name: "John", email: "a@b.com", password: "12345" } };
        const res = mockResponse();
        validateRegistration(req, res, () => {});
        assert.strictEqual(res._status, 400);
        assert.ok(res._body.message.includes("Password"));
    });

    it("should reject admin role self-registration", () => {
        const req = { body: { name: "John", email: "a@b.com", password: "secret123", role: "admin" } };
        const res = mockResponse();
        validateRegistration(req, res, () => {});
        assert.strictEqual(res._status, 400);
        assert.ok(res._body.message.toLowerCase().includes("admin"));
    });

    it("should reject vendor without business_name", () => {
        const req = { body: { name: "John", email: "a@b.com", password: "secret123", role: "vendor" } };
        const res = mockResponse();
        validateRegistration(req, res, () => {});
        assert.strictEqual(res._status, 400);
        assert.ok(res._body.message.includes("business name"));
    });

    it("should pass for valid customer registration", () => {
        const req = { body: { name: "John Doe", email: "john@example.com", password: "secret123", role: "customer" } };
        const res = mockResponse();
        let nextCalled = false;
        validateRegistration(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(res._status, 200);
    });

    it("should pass for valid vendor registration with business_name", () => {
        const req = { body: { name: "Jane", email: "jane@example.com", password: "secret123", role: "vendor", business_name: "Jane's Shop" } };
        const res = mockResponse();
        let nextCalled = false;
        validateRegistration(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    it("should default role to customer when not specified", () => {
        const req = { body: { name: "John Doe", email: "john@example.com", password: "secret123" } };
        const res = mockResponse();
        let nextCalled = false;
        validateRegistration(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateLogin", () => {
    it("should reject when email is missing", () => {
        const req = { body: { password: "secret123" } };
        const res = mockResponse();
        validateLogin(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject when password is missing", () => {
        const req = { body: { email: "a@b.com" } };
        const res = mockResponse();
        validateLogin(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should pass with both fields", () => {
        const req = { body: { email: "a@b.com", password: "secret123" } };
        const res = mockResponse();
        let nextCalled = false;
        validateLogin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateProduct", () => {
    it("should reject short name", () => {
        const req = { body: { name: "A", price: 100, stock: 10, category_id: 1 } };
        const res = mockResponse();
        validateProduct(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject zero price", () => {
        const req = { body: { name: "Product", price: 0, stock: 10, category_id: 1 } };
        const res = mockResponse();
        validateProduct(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject negative stock", () => {
        const req = { body: { name: "Product", price: 100, stock: -1, category_id: 1 } };
        const res = mockResponse();
        validateProduct(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject missing category", () => {
        const req = { body: { name: "Product", price: 100, stock: 10, category_id: "" } };
        const res = mockResponse();
        validateProduct(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should pass with valid data", () => {
        const req = { body: { name: "Product", price: 100, stock: 10, category_id: 1 } };
        const res = mockResponse();
        let nextCalled = false;
        validateProduct(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateCategory", () => {
    it("should reject short name", () => {
        const req = { body: { name: "A" } };
        const res = mockResponse();
        validateCategory(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should pass with valid name", () => {
        const req = { body: { name: "Electronics" } };
        const res = mockResponse();
        let nextCalled = false;
        validateCategory(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateReview", () => {
    it("should reject rating below 1", () => {
        const req = { body: { rating: 0, product_id: 1, order_id: 1 } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject rating above 5", () => {
        const req = { body: { rating: 6, product_id: 1, order_id: 1 } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject non-integer rating", () => {
        const req = { body: { rating: 3.5, product_id: 1, order_id: 1 } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject missing product_id", () => {
        const req = { body: { rating: 4, order_id: 1 } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject missing order_id", () => {
        const req = { body: { rating: 4, product_id: 1 } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should reject comment over 500 chars", () => {
        const longComment = "x".repeat(501);
        const req = { body: { rating: 4, product_id: 1, order_id: 1, comment: longComment } };
        const res = mockResponse();
        validateReview(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should pass with valid review", () => {
        const req = { body: { rating: 5, product_id: 1, order_id: 1, comment: "Great!" } };
        const res = mockResponse();
        let nextCalled = false;
        validateReview(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateUserStatus", () => {
    it("should reject invalid status", () => {
        const req = { body: { status: "deleted" } };
        const res = mockResponse();
        validateUserStatus(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should accept active", () => {
        const req = { body: { status: "active" } };
        const res = mockResponse();
        let nextCalled = false;
        validateUserStatus(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    it("should accept suspended", () => {
        const req = { body: { status: "suspended" } };
        const res = mockResponse();
        let nextCalled = false;
        validateUserStatus(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});

describe("validateUserRole", () => {
    it("should reject invalid role", () => {
        const req = { body: { role: "superadmin" } };
        const res = mockResponse();
        validateUserRole(req, res, () => {});
        assert.strictEqual(res._status, 400);
    });

    it("should accept admin", () => {
        const req = { body: { role: "admin" } };
        const res = mockResponse();
        let nextCalled = false;
        validateUserRole(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });
});
