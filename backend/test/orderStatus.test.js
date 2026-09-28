const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
    canOrderTransition,
    canEscrowTransition,
    canCustomerCancel,
    ORDER_TRANSITIONS,
    ESCROW_TRANSITIONS
} = require("../utils/orderStatus");

describe("Order state transitions", () => {
    it("should allow pending -> paid", () => {
        assert.strictEqual(canOrderTransition("pending", "paid"), true);
    });

    it("should allow pending -> cancelled", () => {
        assert.strictEqual(canOrderTransition("pending", "cancelled"), true);
    });

    it("should allow paid -> shipped", () => {
        assert.strictEqual(canOrderTransition("paid", "shipped"), true);
    });

    it("should allow shipped -> delivered", () => {
        assert.strictEqual(canOrderTransition("shipped", "delivered"), true);
    });

    it("should allow delivered -> refunded", () => {
        assert.strictEqual(canOrderTransition("delivered", "refunded"), true);
    });

    it("should allow shipped -> cancelled", () => {
        assert.strictEqual(canOrderTransition("shipped", "cancelled"), true);
    });

    it("should disallow pending -> delivered directly", () => {
        assert.strictEqual(canOrderTransition("pending", "delivered"), false);
    });

    it("should disallow delivered -> cancelled", () => {
        assert.strictEqual(canOrderTransition("delivered", "cancelled"), false);
    });

    it("should disallow cancelled -> anything", () => {
        assert.strictEqual(canOrderTransition("cancelled", "paid"), false);
        assert.strictEqual(canOrderTransition("cancelled", "refunded"), false);
    });

    it("should disallow refunded -> anything", () => {
        assert.strictEqual(canOrderTransition("refunded", "delivered"), false);
    });
});

describe("Escrow state transitions", () => {
    it("should allow held -> released", () => {
        assert.strictEqual(canEscrowTransition("held", "released"), true);
    });

    it("should allow held -> refunded", () => {
        assert.strictEqual(canEscrowTransition("held", "refunded"), true);
    });

    it("should allow released -> refunded", () => {
        assert.strictEqual(canEscrowTransition("released", "refunded"), true);
    });

    it("should disallow held -> pending", () => {
        assert.strictEqual(canEscrowTransition("held", "pending"), false);
    });

    it("should disallow refunded -> released", () => {
        assert.strictEqual(canEscrowTransition("refunded", "released"), false);
    });
});

describe("Customer cancellation rules", () => {
    it("should allow cancellation from pending", () => {
        assert.strictEqual(canCustomerCancel("pending"), true);
    });

    it("should allow cancellation from paid", () => {
        assert.strictEqual(canCustomerCancel("paid"), true);
    });

    it("should not allow cancellation from shipped", () => {
        assert.strictEqual(canCustomerCancel("shipped"), false);
    });

    it("should not allow cancellation from delivered", () => {
        assert.strictEqual(canCustomerCancel("delivered"), false);
    });
});
