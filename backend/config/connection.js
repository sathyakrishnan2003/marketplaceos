/**
 * Single source of truth for the MySQL connection settings, shared by the
 * request pool (config/db.js) and the CLI scripts, so a hosted database is
 * reached the same way everywhere.
 */

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

function connectionOptions({ database, multipleStatements = false } = {}) {
    return {
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root",
        port: Number(process.env.DB_PORT || 3306),
        // migrate.js connects without a default schema so it can CREATE
        // DATABASE; everything else passes one.
        ...(database ? { database } : {}),
        ssl: sslOptions(),
        multipleStatements
    };
}

module.exports = { sslOptions, connectionOptions };
