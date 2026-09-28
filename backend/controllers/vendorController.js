const db = require("../config/db");

exports.getVendors = async (req, res) => {
    try {
        const [vendors] = await db.query(`
            SELECT v.id, v.business_name, v.description, v.status, v.created_at,
                   COALESCE(COUNT(p.id), 0) AS product_count
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            LEFT JOIN products p
               ON p.vendor_id = v.id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
            WHERE v.status = 'approved'
            AND u.status = 'active'
            AND u.deleted_at IS NULL
            GROUP BY v.id, v.business_name, v.description, v.status, v.created_at
            ORDER BY v.created_at DESC
        `);

        res.json(vendors);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch vendors"
        });
    }
};

exports.getVendor = async (req, res) => {
    try {
        const [vendors] = await db.query(`
            SELECT v.id, v.business_name, v.description, v.status, v.created_at
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            WHERE v.id = ?
            AND v.status = 'approved'
            AND u.status = 'active'
            AND u.deleted_at IS NULL
        `, [req.params.id]);

        if (!vendors.length) {
            return res.status(404).json({
                message: "Vendor not found"
            });
        }

        const vendor = vendors[0];

        const [products] = await db.query(`
            SELECT p.id, p.name, p.description, p.price, p.image, p.tag, p.stock,
                   COALESCE(AVG(r.rating), 0) AS rating,
                   COUNT(r.id) AS review_count
            FROM products p
            LEFT JOIN reviews r ON r.product_id = p.id
            WHERE p.vendor_id = ?
            AND p.deleted_at IS NULL
            AND p.status = 'active'
            GROUP BY p.id, p.name, p.description, p.price, p.image, p.tag, p.stock
            ORDER BY p.created_at DESC
        `, [vendor.id]);

        res.json({
            ...vendor,
            products
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch vendor"
        });
    }
};

exports.listAllVendors = async (req, res) => {
    try {
        const [vendors] = await db.query(`
            SELECT v.id, v.business_name, v.description, v.status, v.created_at, v.updated_at,
                   u.name AS owner_name, u.email AS owner_email, u.status AS owner_status,
                   COALESCE(COUNT(p.id), 0) AS product_count
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            LEFT JOIN products p
               ON p.vendor_id = v.id
               AND p.deleted_at IS NULL
               AND p.status = 'active'
            WHERE u.deleted_at IS NULL
            GROUP BY v.id, v.business_name, v.description, v.status, v.created_at, v.updated_at,
                     u.name, u.email, u.status
            ORDER BY v.created_at DESC
        `);

        res.json(vendors);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch vendors"
        });
    }
};

exports.updateVendorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ["pending", "approved", "suspended"];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                message: "Invalid vendor status"
            });
        }

        const [result] = await db.query(
            `UPDATE vendors SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Vendor not found"
            });
        }

        res.json({
            message: `Vendor ${status} successfully`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update vendor status"
        });
    }
};

exports.approveVendor = async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE vendors SET status = 'approved'
             WHERE id = ? AND status != 'approved'`,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Vendor not found or already approved"
            });
        }

        res.json({ message: "Vendor approved successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to approve vendor"
        });
    }
};

exports.suspendVendor = async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE vendors SET status = 'suspended'
             WHERE id = ? AND status != 'suspended'`,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Vendor not found or already suspended"
            });
        }

        res.json({ message: "Vendor suspended successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to suspend vendor"
        });
    }
};
