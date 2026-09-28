const db = require("../config/db");

exports.getUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT
                id, name, email, role, status,
                created_at, updated_at
             FROM users
             WHERE deleted_at IS NULL
             ORDER BY id DESC`
        );

        res.json(users);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch users"
        });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ["active", "suspended"];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                message: "Invalid user status"
            });
        }

        const [result] = await db.query(
            `UPDATE users
             SET status = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [status, id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: `User ${status === "active" ? "reactivated" : "suspended"} successfully`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update user status"
        });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const allowed = ["customer", "vendor", "admin"];
        if (!allowed.includes(role)) {
            return res.status(400).json({
                message: "Invalid user role"
            });
        }

        const [result] = await db.query(
            `UPDATE users
             SET role = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [role, id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: `User role updated to ${role} successfully`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update user role"
        });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE users
             SET deleted_at = NOW(),
             status = 'suspended'
             WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({ message: "User deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete user"
        });
    }
};
