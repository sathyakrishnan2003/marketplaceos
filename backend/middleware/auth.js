const jwt = require("jsonwebtoken");
const db = require("../config/db");

const ACCESS_EXPIRES_IN = Number(process.env.JWT_ACCESS_EXPIRES_IN) || 900;

function requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            "JWT_SECRET must be set to a strong value of at least 32 characters"
        );
    }
    return secret;
}

function generateAccessToken(payload) {
    return jwt.sign(payload, requireJwtSecret(), {
        expiresIn: ACCESS_EXPIRES_IN,
    });
}

function signRefreshToken(userId) {
    return jwt.sign(
        { id: userId, type: "refresh" },
        requireJwtSecret(),
        { expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN) || 604800 }
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authentication token required"
        });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Invalid authentication token format"
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, requireJwtSecret());
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired",
                code: "TOKEN_EXPIRED"
            });
        }
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

async function authenticateAndLoadUser(req, res, next) {
    authenticateToken(req, res, async () => {
        try {
            const [users] = await db.query(
                "SELECT id, role, status FROM users WHERE id = ? AND deleted_at IS NULL",
                [req.user.id]
            );
            if (!users.length) {
                return res.status(401).json({
                    message: "Account not found"
                });
            }
            const user = users[0];
            if (user.status !== "active") {
                return res.status(403).json({
                    message: "Account is suspended"
                });
            }
            req.user.role = user.role;
            req.user.status = user.status;
            next();
        } catch (error) {
            next(error);
        }
    });
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    authenticateAndLoadUser,
    authorizeRoles,
    generateAccessToken,
    signRefreshToken,
    requireJwtSecret,
    auth: authenticateToken,
    allow: authorizeRoles,
};
