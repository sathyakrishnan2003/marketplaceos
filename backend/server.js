const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

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

const allowAllOrigins = corsOrigin === "*" || corsOrigin === "";

function originAllowed(origin) {
    if (allowAllOrigins) return true;
    return corsOrigins.some(
        (o) => o === origin || (o.endsWith("*") && origin.startsWith(o.slice(0, -1)))
    );
}

app.use(
    cors((req, callback) => {
        const origin = req.headers.origin;
        const requestHost = `${req.protocol}://${req.headers.host}`;

        // Requests from the app's own origin must never be blocked. When the
        // backend serves the built SPA, the browser sends an Origin header for
        // the module script (Vite marks it crossorigin) and rejecting it would
        // block the frontend's own JavaScript and leave a blank page.
        const sameOrigin = !origin || origin === requestHost;
        const allowed = sameOrigin || originAllowed(origin);

        callback(null, {
            origin: allowAllOrigins ? "*" : allowed ? origin : false,
            credentials: true
        });
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

// The built SPA, when present, is served from this same origin so the whole
// app can run on a single host with no CORS setup and no second deploy target.
const FRONTEND_DIST =
    process.env.FRONTEND_DIST || path.join(__dirname, "..", "frontend", "dist");
const hasFrontend = fs.existsSync(FRONTEND_DIST);

app.get("/", (req, res) => {
    if (hasFrontend) {
        return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    }
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

// Client-side routes fall back to index.html; /api and /uploads are excluded so
// unknown endpoints still return JSON 404s.
if (hasFrontend) {
    app.use(express.static(FRONTEND_DIST, { index: false }));

    app.get(/^\/(?!api\/|uploads\/|health$).*/, (req, res, next) => {
        res.sendFile(path.join(FRONTEND_DIST, "index.html"), (err) => {
            if (err) next(err);
        });
    });
}

app.use(notFoundHandler);
app.use(errorHandler);
const PORT = process.env.PORT || 5000;

if (require.main === module) {
    if (!requireJwtSecret()) {
        console.error("FATAL: JWT_SECRET is not set or is too weak (needs 32+ chars). Refusing to start.");
        process.exit(1);
    }

    const start = async () => {
        // Hosts without a shell (Render free) cannot run the migration by hand,
        // so the schema is applied on first boot. Opt out with AUTO_MIGRATE=false
        // when the schema is managed separately.
        if (process.env.AUTO_MIGRATE !== "false") {
            try {
                await require("./scripts/bootstrap")();
            } catch (error) {
                console.error("FATAL: database bootstrap failed:", error.message);
                process.exit(1);
            }
        }

        app.listen(PORT, () => {
            console.log(`MarketplaceOS API running on port ${PORT}`);
        });
    };

    start();
}

module.exports = app;
