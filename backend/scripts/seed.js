/**
 * Seeds demo data into an EXISTING database without dropping or recreating it.
 * Safe for managed MySQL (e.g. Railway plugin) where DROP DATABASE is denied.
 *
 * Run scripts/migrate.js first to create the schema, then this to populate it.
 * Idempotent: re-running will not duplicate rows.
 *
 * Usage: npm run db:seed
 */
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const { connectionOptions } = require("../config/connection");

async function upsertUser(conn, { name, email, passwordHash, role }) {
    await conn.query(
        `INSERT INTO users (name, email, password, role, status)
         VALUES (?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role), status = 'active'`,
        [name, email, passwordHash, role]
    );
    const [[row]] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    return row.id;
}

async function main() {
    const conn = await mysql.createConnection(
        connectionOptions({ database: process.env.DB_NAME || "marketplaceos" })
    );

    const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
    if (!tables.length) {
        throw new Error("Schema not found. Run 'npm run db:migrate' first.");
    }

    const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "admin123", 12);
    const vendorPassword = await bcrypt.hash(process.env.SEED_VENDOR_PASSWORD || "vendor123", 12);
    const customerPassword = await bcrypt.hash(process.env.SEED_CUSTOMER_PASSWORD || "customer123", 12);

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
        await conn.query(
            `INSERT INTO vendors (user_id, business_name, description, status)
             VALUES (?, ?, ?, 'approved')
             ON DUPLICATE KEY UPDATE
                business_name = VALUES(business_name),
                description = VALUES(description),
                status = 'approved'`,
            [userId, businessName, description]
        );
        const [[row]] = await conn.query("SELECT id FROM vendors WHERE user_id = ?", [userId]);
        vendorIds.push(row.id);
    }

    const categoryId = async (label) => {
        const [[row]] = await conn.query("SELECT id FROM categories WHERE name = ?", [label]);
        return row.id;
    };
    const home = await categoryId("Home");
    const kitchen = await categoryId("Kitchen");
    const pantry = await categoryId("Pantry");

    const [[productCount]] = await conn.query("SELECT COUNT(*) AS c FROM products");
    if (Number(productCount.c) === 0) {
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

    console.log(`Seed complete for database "${process.env.DB_NAME || "marketplaceos"}".`);
    console.log("  admin@marketplaceos.test / " + (process.env.SEED_ADMIN_PASSWORD || "admin123"));
    console.log("  kora@marketplaceos.test / " + (process.env.SEED_VENDOR_PASSWORD || "vendor123"));
    console.log("  customer@marketplaceos.test / " + (process.env.SEED_CUSTOMER_PASSWORD || "customer123"));

    await conn.end();
}

module.exports = main;

if (require.main === module) {
    main().catch((error) => {
        console.error("Seed failed:", error.message);
        process.exit(1);
    });
}
