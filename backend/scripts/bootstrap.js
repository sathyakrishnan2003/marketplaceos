/**
 * Prepares the database on boot when the service is deployed to a host with no
 * shell (Render's free tier has none, so `npm run db:migrate` cannot be run by
 * hand there).
 *
 * Applies the schema, then seeds demo data only when the database is empty, so
 * restarts and cold starts never re-seed or duplicate rows.
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const { connectionOptions } = require("../config/connection");

async function isDatabaseEmpty(conn) {
    const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
    if (!tables.length) return true;
    const [[{ total }]] = await conn.query("SELECT COUNT(*) AS total FROM users");
    return Number(total) === 0;
}

async function ensureSchema({ log = console.log } = {}) {
    const migrate = require("./migrate");
    const seed = require("./seed");

    await migrate();
    log("[bootstrap] schema applied");

    const conn = await mysql.createConnection(
        connectionOptions({ database: process.env.DB_NAME || "marketplaceos" })
    );
    let empty;
    try {
        empty = await isDatabaseEmpty(conn);
    } finally {
        await conn.end();
    }

    if (empty) {
        await seed();
        log("[bootstrap] seeded demo data");
    } else {
        log("[bootstrap] existing data left untouched");
    }
}

module.exports = ensureSchema;

if (require.main === module) {
    ensureSchema().catch((error) => {
        console.error("Bootstrap failed:", error.message);
        process.exit(1);
    });
}
