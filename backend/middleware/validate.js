function validateRegistration(req, res, next) {
    const { name, email, password, role, business_name } = req.body;

    if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: "A valid email is required" });
    }

    if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (role === "admin") {
        return res.status(400).json({ message: "Admin accounts cannot be self-provisioned" });
    }

    if (role === "vendor" && (!business_name || String(business_name).trim().length < 2)) {
        return res.status(400).json({ message: "Vendor business name is required" });
    }

    next();
}

function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    next();
}

function validateProduct(req, res, next) {
    const { name, price, stock, category_id } = req.body;

    if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ message: "Product name is required" });
    }

    const numPrice = Number(price);
    if (!price || isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ message: "Valid price is required" });
    }

    const numStock = Number(stock);
    if (stock === undefined || isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ message: "Valid stock quantity is required" });
    }

    if (!category_id || isNaN(Number(category_id))) {
        return res.status(400).json({ message: "Valid category is required" });
    }

    next();
}

function validateCategory(req, res, next) {
    const { name } = req.body;

    if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ message: "Category name is required" });
    }

    next();
}

function validateReview(req, res, next) {
    const { rating, comment, product_id, order_id } = req.body;

    const numRating = Number(rating);
    if (!rating || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }

    if (!product_id || isNaN(Number(product_id))) {
        return res.status(400).json({ message: "Product ID is required" });
    }

    if (!order_id || isNaN(Number(order_id))) {
        return res.status(400).json({ message: "Order ID is required" });
    }

    if (comment !== undefined && comment !== null && String(comment).length > 500) {
        return res.status(400).json({ message: "Review comment must be 500 characters or fewer" });
    }

    next();
}

function validateUserStatus(req, res, next) {
    const { status } = req.body;
    const allowed = ["active", "suspended"];
    if (!status || !allowed.includes(status)) {
        return res.status(400).json({
            message: "Invalid user status. Use 'active' or 'suspended'"
        });
    }
    next();
}

function validateUserRole(req, res, next) {
    const { role } = req.body;
    const allowed = ["customer", "vendor", "admin"];
    if (!role || !allowed.includes(role)) {
        return res.status(400).json({
            message: "Invalid user role. Use 'customer', 'vendor', or 'admin'"
        });
    }
    next();
}

module.exports = {
    validateRegistration,
    validateLogin,
    validateProduct,
    validateCategory,
    validateReview,
    validateUserStatus,
    validateUserRole,
};
