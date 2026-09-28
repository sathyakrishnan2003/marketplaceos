const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    createOrder,
    getOrders,
    getOrder,
    getVendorOrders,
    markShipped,
    cancelOrder,
    refundOrder,
    confirmDelivery,
    getEscrowLedger,
    adminReleaseEscrow,
    adminRefundEscrow
} = require("../controllers/orderController");

router.use(authenticateAndLoadUser);

router.get("/vendor/mine", authorizeRoles("vendor"), getVendorOrders);
router.get("/admin/escrow", authorizeRoles("admin"), getEscrowLedger);
router.post("/admin/escrow/:id/release", authorizeRoles("admin"), adminReleaseEscrow);
router.post("/admin/escrow/:id/refund", authorizeRoles("admin"), adminRefundEscrow);

router.get("/", getOrders);
router.post("/", createOrder);
router.get("/:id", getOrder);
router.post("/:id/confirm-delivery", confirmDelivery);
router.post("/:id/ship", authorizeRoles("vendor", "admin"), markShipped);
router.post("/:id/cancel", cancelOrder);
router.post("/:id/refund", authorizeRoles("admin"), refundOrder);

module.exports = router;
