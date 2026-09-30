const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const { connectionOptions } = require("./connection");

const db = mysql.createPool({
    ...connectionOptions({ database: process.env.DB_NAME }),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.on("error", (err) => {
    console.error("Database pool error:", err);
});

module.exports = db;
