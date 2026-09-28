const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    getVendors,
    getVendor,
    listAllVendors,
    updateVendorStatus,
    approveVendor,
    suspendVendor
} = require("../controllers/vendorController");

router.get("/", getVendors);

router.get("/admin/all", authenticateAndLoadUser, authorizeRoles("admin"), listAllVendors);
router.put("/admin/:id/status", authenticateAndLoadUser, authorizeRoles("admin"), updateVendorStatus);
router.post("/admin/:id/approve", authenticateAndLoadUser, authorizeRoles("admin"), approveVendor);
router.post("/admin/:id/suspend", authenticateAndLoadUser, authorizeRoles("admin"), suspendVendor);

router.get("/:id", getVendor);

module.exports = router;
