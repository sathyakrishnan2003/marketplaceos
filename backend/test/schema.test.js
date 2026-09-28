const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "schema.sql");
const migrationsDir = path.join(__dirname, "..", "migrations");

describe("Schema integrity", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");

    it("should define users table with role and status", () => {
        assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS users"));
        assert.ok(schema.includes("role ENUM('customer','vendor','admin')"));
        assert.ok(schema.includes("status ENUM('active','suspended')"));
        assert.ok(schema.includes("deleted_at"));
    });

    it("should define vendors table with approval status", () => {
        assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS vendors"));
        assert.ok(schema.includes("status ENUM('pending','approved','suspended')"));
        assert.ok(schema.includes("business_name"));
    });

    it("should define escrow_transactions with provider and reference", () => {
        assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS escrow_transactions"));
        assert.ok(schema.includes("provider"));
        assert.ok(schema.includes("reference"));
        assert.ok(schema.includes("refunded_at"));
    });

    it("should define orders with refunded status", () => {
        assert.ok(schema.includes("status ENUM('pending','paid','shipped','delivered','cancelled','refunded')"));
    });

    it("should define refresh_tokens table for token revocation", () => {
        assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS refresh_tokens"));
    });

    it("should define order_audit table for state history", () => {
        assert.ok(schema.includes("CREATE TABLE IF NOT EXISTS order_audit"));
    });

    it("should seed default categories", () => {
        assert.ok(schema.includes("INSERT IGNORE INTO categories"));
        assert.ok(schema.includes("'Home'"));
        assert.ok(schema.includes("'Pantry'"));
    });
});

describe("Migration files", () => {
    it("should have migration directory with .sql files", () => {
        assert.ok(fs.existsSync(migrationsDir));
        const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
        assert.ok(files.length >= 1);
    });

    it("should have 001_platform_fields migration", () => {
        const p = path.join(migrationsDir, "001_platform_fields.sql");
        assert.ok(fs.existsSync(p));
    });

    it("should have 002_enhancements migration", () => {
        const p = path.join(migrationsDir, "002_enhancements.sql");
        assert.ok(fs.existsSync(p));
    });
});
