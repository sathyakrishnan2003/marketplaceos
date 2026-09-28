const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

const { rateLimit, createRateLimiter, _resetStore } = require("../middleware/rateLimit");

function mockRequest(ip = "192.168.1.1", overrides = {}) {
    return {
        ip: ip,
        connection: { remoteAddress: ip },
        headers: {},
        ...overrides
    };
}

function mockResponse() {
    const res = {
        _headers: {},
        _status: 200,
        _body: null,
    };
    res.status = (code) => { res._status = code; return res; };
    res.json = (data) => { res._body = data; return res; };
    res.set = (key, value) => { res._headers[key] = value; return res; };
    return res;
}

describe("rateLimit middleware", () => {
    before(() => _resetStore());
    after(() => _resetStore());

    it("should allow requests under the limit", () => {
        _resetStore();
        const limiter = rateLimit({ windowMs: 60000, max: 3 });
        const req = mockRequest("10.0.0.1");
        const res = mockResponse();
        let called = 0;
        const next = () => { called++; };

        limiter(req, res, next);
        assert.strictEqual(called, 1);

        limiter(req, res, next);
        assert.strictEqual(called, 2);

        limiter(req, res, next);
        assert.strictEqual(called, 3);
        assert.strictEqual(res._status, 200);
    });

    it("should block requests over the limit with 429", () => {
        _resetStore();
        const limiter = rateLimit({ windowMs: 60000, max: 2 });
        const req = mockRequest("10.0.0.2");

        const res1 = mockResponse();
        limiter(req, res1, () => {});
        assert.strictEqual(res1._status, 200);

        const res2 = mockResponse();
        limiter(req, res2, () => {});
        assert.strictEqual(res2._status, 200);

        const res3 = mockResponse();
        let nextCalled = false;
        limiter(req, res3, () => { nextCalled = true; });
        assert.strictEqual(res3._status, 429);
        assert.strictEqual(nextCalled, false);
        assert.ok(res3._body.retry_after >= 0);
    });

    it("should set rate limit headers on allowed requests", () => {
        _resetStore();
        const limiter = rateLimit({ windowMs: 60000, max: 10 });
        const req = mockRequest("10.0.0.3");
        const res = mockResponse();

        limiter(req, res, () => {});
        assert.strictEqual(res._headers["X-RateLimit-Limit"], "10");
        assert.strictEqual(res._headers["X-RateLimit-Remaining"], "9");
    });

    it("should reset count when window expires", () => {
        _resetStore();
        const limiter = rateLimit({ windowMs: 10, max: 1 });
        const req = mockRequest("10.0.0.4");

        const res1 = mockResponse();
        limiter(req, res1, () => {});
        assert.strictEqual(res1._status, 200);

        const res2 = mockResponse();
        limiter(req, res2, () => {});
        assert.strictEqual(res2._status, 429);

        setTimeout(() => {
            const res3 = mockResponse();
            limiter(req, res3, () => {});
            assert.strictEqual(res3._status, 200);
        }, 20);
    });

    it("should isolate rate limits per IP", () => {
        _resetStore();
        const limiter = rateLimit({ windowMs: 60000, max: 1 });

        const reqA = mockRequest("10.0.0.5");
        const resA = mockResponse();
        limiter(reqA, resA, () => {});
        assert.strictEqual(resA._status, 200);

        const reqB = mockRequest("10.0.0.6");
        const resB = mockResponse();
        limiter(reqB, resB, () => {});
        assert.strictEqual(resB._status, 200);
    });
});
