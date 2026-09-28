const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const db = require("./config/db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const userRoutes = require("./routes/users");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const reviewRoutes = require("./routes/reviews");
const analyticsRoutes = require("./routes/analytics");
const vendorRoutes = require("./routes/vendors");

const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { createRateLimiter } = require("./middleware/rateLimit");
const { requireJwtSecret } = require("./middleware/auth");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim());

const allowedOrigins =
    corsOrigin === "*" || corsOrigin === ""
        ? "*"
        : corsOrigins;

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins === "*") {
                return callback(null, true);
            }
            const isAllowed = corsOrigins.some(
                (o) => o === origin || (o.endsWith("*") && origin.startsWith(o.slice(0, -1)))
            );
            if (isAllowed) {
                return callback(null, true);
            }
            callback(new Error("Not allowed by CORS"));
        },
        credentials: true
    })
);

const generalRateLimiter = createRateLimiter(
    process.env.RATE_LIMIT_GENERAL_MAX || 300,
    process.env.RATE_LIMIT_GENERAL_WINDOW || 900
);

app.use(generalRateLimiter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
app.use(
    "/uploads",
    express.static(UPLOAD_DIR)
);

app.get("/", (req, res) => {
    res.json({
        message: "MarketplaceOS API is running"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString()
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/vendors", vendorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    if (!requireJwtSecret()) {
        console.error("FATAL: JWT_SECRET is not set or is too weak (needs 32+ chars). Refusing to start.");
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`MarketplaceOS API running on port ${PORT}`);
    });
}

module.exports = app;
