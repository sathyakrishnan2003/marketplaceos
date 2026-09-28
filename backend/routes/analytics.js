const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    getSummary,
    getVendorSummary,
    getTimeSeries,
    getVendorTimeSeries,
    getTopProducts,
    getTopCategories,
    getVendorPerformance
} = require("../controllers/analyticsController");

router.get("/summary", authenticateAndLoadUser, authorizeRoles("admin"), getSummary);
router.get("/summary/time-series", authenticateAndLoadUser, authorizeRoles("admin"), getTimeSeries);
router.get("/summary/top-products", authenticateAndLoadUser, authorizeRoles("admin"), getTopProducts);
router.get("/summary/top-categories", authenticateAndLoadUser, authorizeRoles("admin"), getTopCategories);
router.get("/summary/vendor-performance", authenticateAndLoadUser, authorizeRoles("admin"), getVendorPerformance);

router.get("/vendor", authenticateAndLoadUser, authorizeRoles("vendor"), getVendorSummary);
router.get("/vendor/time-series", authenticateAndLoadUser, authorizeRoles("vendor"), getVendorTimeSeries);

module.exports = router;
