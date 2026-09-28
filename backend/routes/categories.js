const express = require("express");

const router = express.Router();

const {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    validateCategory
} = require("../middleware/validate");

router.get("/", getCategories);

router.post(
    "/",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    validateCategory,
    createCategory
);

router.put(
    "/:id",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    validateCategory,
    updateCategory
);

router.delete(
    "/:id",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    deleteCategory
);

module.exports = router;
