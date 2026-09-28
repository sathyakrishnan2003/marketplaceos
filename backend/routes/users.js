const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    getUsers,
    updateUserStatus,
    updateUserRole,
    deleteUser
} = require("../controllers/userController");

const {
    validateUserStatus,
    validateUserRole
} = require("../middleware/validate");

router.get("/", authenticateAndLoadUser, authorizeRoles("admin"), getUsers);

router.put(
    "/:id/status",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    validateUserStatus,
    updateUserStatus
);

router.put(
    "/:id/role",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    validateUserRole,
    updateUserRole
);

router.delete(
    "/:id",
    authenticateAndLoadUser,
    authorizeRoles("admin"),
    deleteUser
);

module.exports = router;
