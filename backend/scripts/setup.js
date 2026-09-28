/**
 * Creates the marketplaceos database, applies schema.sql + migrations, and seeds demo data.
 * Idempotent and safe to re-run (drops and rebuilds for a deterministic dev environment).
 * Usage: npm run db:setup
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const DB_NAME = process.env.DB_NAME || "marketplaceos";
const IGNORABLE = new Set(["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_CANT_DROP_FIELD_OR_KEY"]);

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

async function upsertUser(conn, { name, email, passwordHash, role }) {
    const [result] = await conn.query(
        `INSERT INTO users (name, email, password, role, status)
         VALUES (?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role)`,
        [name, email, passwordHash, role]
    );
    if (result.insertId) return result.insertId;
    const [[row]] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    return row.id;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root",
        port: Number(process.env.DB_PORT || 3306),
        multipleStatements: true,
    });

    // Deterministic dev seed: rebuild the schema so column/FK changes always apply cleanly.
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    await conn.query(`CREATE DATABASE \`${DB_NAME}\``);
    await conn.changeUser({ database: DB_NAME });
    await conn.query(fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8"));

    const migrationDir = path.join(__dirname, "..", "migrations");
    if (fs.existsSync(migrationDir)) {
        const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
        for (const file of files) {
            const contents = fs.readFileSync(path.join(migrationDir, file), "utf8");
            await runIgnoringDuplicates(conn, contents.split(";"));
        }
    }

    const adminPassword = await bcrypt.hash("admin123", 12);
    const vendorPassword = await bcrypt.hash("vendor123", 12);
    const customerPassword = await bcrypt.hash("customer123", 12);

    await upsertUser(conn, { name: "Platform Admin", email: "admin@marketplaceos.test", passwordHash: adminPassword, role: "admin" });
    await upsertUser(conn, { name: "Demo Customer", email: "customer@marketplaceos.test", passwordHash: customerPassword, role: "customer" });

    const vendors = [
        ["Kora Living", "kora@marketplaceos.test", "Furniture and textiles for calm homes."],
        ["Mitti Studio", "mitti@marketplaceos.test", "Ceramics and small-batch homeware."],
        ["The Apiary Co.", "apiary@marketplaceos.test", "Raw honey and pantry favourites."]
    ];

    const vendorIds = [];
    for (const [businessName, email, description] of vendors) {
        const userId = await upsertUser(conn, { name: businessName, email, passwordHash: vendorPassword, role: "vendor" });
        const [vendorResult] = await conn.query(
            `INSERT INTO vendors (user_id, business_name, description, status)
             VALUES (?, ?, ?, 'approved')
             ON DUPLICATE KEY UPDATE business_name = VALUES(business_name), description = VALUES(description), status = 'approved'`,
            [userId, businessName, description]
        );
        let vendorId = vendorResult.insertId;
        if (!vendorId) {
            const [[row]] = await conn.query("SELECT id FROM vendors WHERE user_id = ?", [userId]);
            vendorId = row.id;
        }
        vendorIds.push(vendorId);
    }

    const categoryId = async (label) => {
        const [[row]] = await conn.query("SELECT id FROM categories WHERE name = ?", [label]);
        return row.id;
    };
    const home = await categoryId("Home");
    const kitchen = await categoryId("Kitchen");
    const pantry = await categoryId("Pantry");

    const [[productCount]] = await conn.query("SELECT COUNT(*) AS c FROM products");
    if (productCount.c === 0) {
        const products = [
            [home, "Linen lounge chair", "Solid wood lounge chair with a linen weave.", 12900, 12, "Top seller", vendorIds[0]],
            [home, "Handwoven cotton throw", "Soft cotton throw woven on a traditional loom.", 3200, 30, "", vendorIds[0]],
            [kitchen, "Ceramic pour-over set", "Hand-thrown stoneware coffee set.", 2450, 40, "New", vendorIds[1]],
            [home, "Cedar room candle", "Soy wax candle with cedar and vetiver.", 950, 60, "", vendorIds[1]],
            [pantry, "Wildflower honey", "Unfiltered raw honey from wildflower meadows.", 680, 100, "Bestseller", vendorIds[2]],
            [pantry, "Daily ritual tea", "Whole-leaf tea blend for everyday mornings.", 540, 80, "", vendorIds[2]]
        ];
        for (const [categoryValue, name, description, price, stock, tag, vendorId] of products) {
            await conn.query(
                `INSERT INTO products (vendor_id, category_id, name, description, price, stock, tag, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                [vendorId, categoryValue, name, description, price, stock, tag]
            );
        }
    }

    console.log(`Database "${DB_NAME}" is ready.`);
    console.log("  admin@marketplaceos.test / admin123");
    console.log("  kora@marketplaceos.test / vendor123");
    console.log("  customer@marketplaceos.test / customer123");

    await conn.end();
}

main().catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
});
