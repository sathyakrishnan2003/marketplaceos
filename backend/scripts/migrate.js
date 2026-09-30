/**
 * Applies schema.sql + migrations to an existing database without dropping it.
 * Safe to re-run: CREATE TABLE IF NOT EXISTS, INSERT IGNORE, and ALTER
 * statements that tolerate "duplicate column" / "duplicate key" errors.
 * Usage: npm run db:migrate
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

const { connectionOptions } = require("../config/connection");

const IGNORABLE = new Set(["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY", "ER_DUP_ENTRY"]);

async function runIgnoringDuplicates(conn, statements) {
    for (const statement of statements) {
        const sql = statement.trim();
        if (!sql) continue;
        try {
            await conn.query(sql);
        } catch (error) {
            if (!IGNORABLE.has(error.code)) throw error;
        }
    }
}

async function main() {
    const dbName = process.env.DB_NAME || "marketplaceos";

    // Creating the schema may need a connection with no default database, so
    // the server is created first and the schema connection opened afterwards.
    const server = await mysql.createConnection(connectionOptions({ multipleStatements: true }));
    await server.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await server.end();

    const conn = await mysql.createConnection(
        connectionOptions({ database: dbName, multipleStatements: true })
    );

    const [[current]] = await conn.query("SELECT DATABASE() AS db");
    if (current.db !== dbName) {
        throw new Error(`Connected to "${current.db}" but expected "${dbName}"`);
    }

    const schemaPath = path.join(__dirname, "..", "schema.sql");
    await runIgnoringDuplicates(conn, fs.readFileSync(schemaPath, "utf8").split(";"));

    const migrationDir = path.join(__dirname, "..", "migrations");
    if (fs.existsSync(migrationDir)) {
        const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
        for (const file of files) {
            const contents = fs.readFileSync(path.join(migrationDir, file), "utf8");
            await runIgnoringDuplicates(conn, contents.split(";"));
        }
    }

    const [[{ total }]] = await conn.query(
        "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?",
        [dbName]
    );
    console.log(`Database "${dbName}" migrated successfully (${total} tables).`);
    await conn.end();
}

module.exports = main;

if (require.main === module) {
    main().catch((error) => {
        console.error("Migration failed:", error);
        process.exit(1);
    });
}
