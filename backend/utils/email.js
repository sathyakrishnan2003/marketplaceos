const nodemailer = require("nodemailer");

let transporter = null;

if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} else {
    transporter = nodemailer.createTransport({
        json: true,
    });
}

async function sendMail(options) {
    if (!transporter) {
        console.warn("Email not configured (SMTP_HOST not set):", options.subject);
        return { messageId: "noop" };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || "no-reply@marketplaceos.example",
            ...options,
        });
        return info;
    } catch (error) {
        console.error("Email send failed:", error.message);
        return { messageId: "noop", error: error.message };
    }
}

module.exports = { sendMail, transporter };
