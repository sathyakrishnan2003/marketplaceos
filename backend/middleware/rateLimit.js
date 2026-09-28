const rateLimitStore = new Map();

function rateLimit({
    windowMs = 900000,
    max = 100,
    message = { message: "Too many requests, please try again later." },
    keyGenerator = (req) => req.ip || req.connection.remoteAddress,
    resetOnSuccess = false
} = {}) {
    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        let entry = rateLimitStore.get(key);
        if (!entry) {
            entry = { count: 0, reset: now + windowMs };
        }

        if (entry.reset < now) {
            entry = { count: 0, reset: now + windowMs };
        }

        entry.count++;

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.reset - now) / 1000);
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                ...message,
                retry_after: retryAfter
            });
        }

        rateLimitStore.set(key, entry);
        res.set("X-RateLimit-Limit", String(max));
        res.set("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));

        if (resetOnSuccess) {
            res.once("finish", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    rateLimitStore.delete(key);
                }
            });
        }

        next();
    };
}

function createRateLimiter(max, windowSecs, options = {}) {
    return rateLimit({
        windowMs: (Number(windowSecs) || 900) * 1000,
        max: Number(max) || 100,
        ...options,
    });
}

module.exports = {
    rateLimit,
    createRateLimiter,
    _resetStore() {
        rateLimitStore.clear();
    }
};
