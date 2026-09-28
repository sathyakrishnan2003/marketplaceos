const db = require("../config/db");

exports.getCategories = async (req, res) => {
    try {
        const [categories] = await db.query(
            `SELECT id, name, description
             FROM categories
             WHERE deleted_at IS NULL
             ORDER BY name`
        );

        res.json(categories);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch categories"
        });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        const [result] = await db.query(
            "INSERT INTO categories (name, description) VALUES (?, ?)",
            [name, description || null]
        );

        res.status(201).json({
            message: "Category created successfully",
            category: { id: result.insertId, name, description: description || null }
        });

    } catch (error) {
        console.error(error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "Category name already exists"
            });
        }
        res.status(500).json({
            message: "Failed to create category"
        });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const [result] = await db.query(
            `UPDATE categories
             SET name = ?, description = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [name, description || null, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        res.json({ message: "Category updated successfully" });

    } catch (error) {
        console.error(error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "Category name already exists"
            });
        }
        res.status(500).json({
            message: "Failed to update category"
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE categories
             SET deleted_at = NOW()
             WHERE id = ? AND deleted_at IS NULL`,
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        res.json({ message: "Category deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete category"
        });
    }
};
