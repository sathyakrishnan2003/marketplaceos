const ORDER_TRANSITIONS = {
    pending: ["paid", "cancelled"],
    paid: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: ["refunded"],
    cancelled: [],
    refunded: []
};

const ESCROW_TRANSITIONS = {
    held: ["released", "refunded"],
    released: ["refunded"],
    refunded: []
};

function canTransition(currentState, nextState, transitions) {
    const allowed = transitions[currentState];
    if (!allowed) return false;
    return allowed.includes(nextState);
}

function canOrderTransition(currentStatus, nextStatus) {
    return canTransition(currentStatus, nextStatus, ORDER_TRANSITIONS);
}

function canEscrowTransition(currentStatus, nextStatus) {
    return canTransition(currentStatus, nextStatus, ESCROW_TRANSITIONS);
}

function canCustomerCancel(status) {
    return ["pending", "paid"].includes(status);
}

module.exports = {
    ORDER_TRANSITIONS,
    ESCROW_TRANSITIONS,
    canOrderTransition,
    canEscrowTransition,
    canCustomerCancel
};
