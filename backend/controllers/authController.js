const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { generateAccessToken, requireJwtSecret } = require("../middleware/auth");

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "900";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "604800";

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

exports.register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            role,
            business_name
        } = req.body;

        const userRole = role === "vendor" ? "vendor" : "customer";
        const businessName = role === "vendor"
            ? (business_name && String(business_name).trim())
            : null;

        const hashedPassword = await bcrypt.hash(password, 12);

        let userId;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO users
                 (name, email, password, role, status)
                 VALUES (?,?,?,?,'active')`,
                [name, email, hashedPassword, userRole]
            );
            userId = result.insertId;

            if (userRole === "vendor") {
                await connection.query(
                    `INSERT INTO vendors
                     (user_id, business_name, description, status)
                     VALUES (?,?,?,'pending')`,
                    [userId, businessName || name, req.body.description || null]
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Email already registered"
                });
            }
            throw error;
        } finally {
            connection.release();
        }

        res.status(201).json({
            message: "Registration successful",
            user: {
                id: userId,
                name,
                email,
                role: userRole,
                status: "active"
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Registration failed"
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await db.query(
            `SELECT *
             FROM users
             WHERE email = ?
             AND deleted_at IS NULL`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        if (user.status !== "active") {
            return res.status(403).json({
                message: "Account is suspended"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const accessToken = generateAccessToken({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });

        const refreshToken = crypto.randomBytes(48).toString("hex");
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = new Date(Date.now() + Number(REFRESH_EXPIRES_IN) * 1000);

        await db.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?,?,?)`,
            [user.id, refreshTokenHash, expiresAt]
        );

        res.json({
            message: "Login successful",
            token: accessToken,
            refresh_token: refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Login failed"
        });
    }
};

exports.refresh = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                message: "Refresh token is required"
            });
        }

        const refreshTokenHash = hashRefreshToken(refresh_token);
        const [tokens] = await db.query(
            `SELECT rt.id, rt.user_id, rt.expires_at,
                    u.id AS user_id_check, u.name, u.email, u.role, u.status
             FROM refresh_tokens rt
             JOIN users u ON u.id = rt.user_id
             WHERE rt.token_hash = ?
             AND rt.expires_at > NOW()
             AND u.deleted_at IS NULL
             AND u.status = 'active'`,
            [refreshTokenHash]
        );

        if (!tokens.length) {
            return res.status(401).json({
                message: "Invalid or expired refresh token"
            });
        }

        const tokenRow = tokens[0];

        await db.query(
            "DELETE FROM refresh_tokens WHERE user_id = ? AND id < ?",
            [tokenRow.user_id, tokenRow.id]
        );

        const accessToken = generateAccessToken({
            id: tokenRow.user_id,
            name: tokenRow.name,
            email: tokenRow.email,
            role: tokenRow.role
        });

        res.json({
            token: accessToken,
            user: {
                id: tokenRow.user_id,
                name: tokenRow.name,
                email: tokenRow.email,
                role: tokenRow.role,
                status: tokenRow.status
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Token refresh failed"
        });
    }
};

exports.logout = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (refresh_token) {
            const refreshTokenHash = hashRefreshToken(refresh_token);
            await db.query(
                "DELETE FROM refresh_tokens WHERE token_hash = ?",
                [refreshTokenHash]
            );
        }

        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Logout failed" });
    }
};

exports.me = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, name, email, role, status
             FROM users
             WHERE id = ? AND deleted_at IS NULL`,
            [req.user.id]
        );

        if (!users.length) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch user"
        });
    }
};
