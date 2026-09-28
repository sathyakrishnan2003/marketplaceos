const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    validateProduct
} = require("../middleware/validate");

const upload = require("../middleware/upload");

const {
    getProducts,
    getProduct,
    createProduct,
    getVendorProducts
} = require("../controllers/productController");

router.get("/", getProducts);
router.get("/mine", authenticateAndLoadUser, authorizeRoles("vendor", "admin"), getVendorProducts);
router.get("/:id", getProduct);

router.post(
    "/",
    authenticateAndLoadUser,
    authorizeRoles("vendor", "admin"),
    upload.single("image"),
    validateProduct,
    createProduct
);

module.exports = router;
