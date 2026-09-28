const db = require("../config/db");

exports.getProducts = async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.image,
                p.tag,
                p.status,
                p.created_at,
                c.name AS category,
                v.business_name AS vendor,
                COALESCE(AVG(r.rating), 0) AS rating,
                COUNT(r.id) AS review_count,
                COALESCE(SUM(oi.quantity), 0) AS sales
            FROM products p
            JOIN categories c
                ON p.category_id = c.id
            JOIN vendors v
                ON p.vendor_id = v.id
            LEFT JOIN reviews r
                ON r.product_id = p.id
            LEFT JOIN order_items oi
                ON oi.product_id = p.id
                AND oi.order_id IN (
                    SELECT id FROM orders WHERE status IN ('delivered','shipped') AND status <> 'cancelled'
                )
            WHERE p.deleted_at IS NULL
            AND p.status = 'active'
            AND v.status = 'approved'
            GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image, p.tag, p.status, p.created_at, c.name, v.business_name
            ORDER BY p.created_at DESC
        `);

        res.json(products);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch products"
        });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.image,
                p.tag,
                p.status,
                p.created_at,
                c.id AS category_id,
                c.name AS category,
                v.id AS vendor_id,
                v.business_name AS vendor,
                COALESCE(AVG(r.rating), 0) AS rating,
                COUNT(r.id) AS review_count
            FROM products p
            JOIN categories c
                ON p.category_id = c.id
            JOIN vendors v
                ON p.vendor_id = v.id
            LEFT JOIN reviews r
                ON r.product_id = p.id
            WHERE p.id = ?
            AND p.deleted_at IS NULL
            AND p.status = 'active'
            AND v.status = 'approved'
            GROUP BY p.id
        `, [req.params.id]);

        if (!products.length) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(products[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch product"
        });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            stock,
            category_id,
            tag
        } = req.body;

        const [vendors] = await db.query(
            "SELECT id FROM vendors WHERE user_id = ? AND status = 'approved'",
            [req.user.id]
        );

        if (!vendors.length) {
            return res.status(403).json({
                message: "Vendor profile not found or not approved"
            });
        }

        const image = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        await db.query(
            `INSERT INTO products
             (vendor_id, category_id, name, description,
              price, stock, image, tag, status)
             VALUES (?,?,?,?,?,?,?,'active')`,
            [
                vendors[0].id,
                category_id,
                name,
                description || "",
                price,
                stock,
                image,
                tag || null
            ]
        );

        res.status(201).json({
            message: "Product created successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to create product"
        });
    }
};

exports.getVendorProducts = async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.id, p.name, p.description, p.price, p.stock, p.image, p.tag,
                   p.status, p.created_at, c.name AS category, v.business_name AS vendor,
                   COALESCE(AVG(r.rating), 0) AS rating,
                   COUNT(r.id) AS review_count,
                   COALESCE(SUM(oi.quantity), 0) AS sales
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN vendors v ON p.vendor_id = v.id
            LEFT JOIN reviews r ON r.product_id = p.id
            LEFT JOIN order_items oi
               ON oi.product_id = p.id
               AND oi.order_id IN (
                   SELECT id FROM orders WHERE status IN ('delivered','shipped') AND status <> 'cancelled'
               )
            WHERE v.user_id = ? AND p.deleted_at IS NULL
            GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image, p.tag,
                     p.status, p.created_at, c.name, v.business_name
            ORDER BY p.created_at DESC`,
            [req.user.id]);
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch vendor products" });
    }
};
