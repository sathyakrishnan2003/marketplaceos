const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

// Managed MySQL providers (Aiven, PlanetScale, Railway, etc.) expose the
// database over the public internet and expect TLS. Enable it with DB_SSL=true.
function sslOptions() {
    if (process.env.DB_SSL !== "true") return undefined;
    return {
        // Hosted providers issue certs from a CA that is not in Node's bundle by
        // default, so verification is opt-out and must be set explicitly.
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true"
    };
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: sslOptions(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.on("error", (err) => {
    console.error("Database pool error:", err);
});

module.exports = db;
