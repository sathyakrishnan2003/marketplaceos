const express = require("express");

const router = express.Router();

const {
    register,
    login,
    refresh,
    logout,
    me
} = require("../controllers/authController");

const {
    authenticateAndLoadUser
} = require("../middleware/auth");

const {
    validateRegistration,
    validateLogin
} = require("../middleware/validate");

const { createRateLimiter } = require("../middleware/rateLimit");

const registrationRateLimiter = createRateLimiter(
    process.env.RATE_LIMIT_REGISTRATION_MAX || 20,
    process.env.RATE_LIMIT_REGISTRATION_WINDOW || 900,
    {
        keyGenerator: (req) => `${req.ip || req.connection.remoteAddress}|register|${String(req.body?.email || "").trim().toLowerCase()}`,
        resetOnSuccess: true
    }
);

const loginRateLimiter = createRateLimiter(
    process.env.RATE_LIMIT_LOGIN_MAX || 20,
    process.env.RATE_LIMIT_LOGIN_WINDOW || 900,
    {
        keyGenerator: (req) => `${req.ip || req.connection.remoteAddress}|login|${String(req.body?.email || "").trim().toLowerCase()}`,
        resetOnSuccess: true
    }
);

const sessionRateLimiter = createRateLimiter(
    process.env.RATE_LIMIT_SESSION_MAX || 30,
    process.env.RATE_LIMIT_SESSION_WINDOW || 900
);

router.post("/register", registrationRateLimiter, validateRegistration, register);

router.post("/login", loginRateLimiter, validateLogin, login);

router.post("/refresh", sessionRateLimiter, refresh);

router.post("/logout", sessionRateLimiter, logout);

router.get("/me", authenticateAndLoadUser, me);

module.exports = router;
