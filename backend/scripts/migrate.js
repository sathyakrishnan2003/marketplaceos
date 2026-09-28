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
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root",
        port: Number(process.env.DB_PORT || 3306),
        multipleStatements: true,
    });

    const dbName = process.env.DB_NAME || "marketplaceos";
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.changeUser({ database: dbName });

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

    console.log(`Database "${dbName}" migrated successfully.`);
    await conn.end();
}

main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
