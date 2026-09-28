function errorHandler(err, req, res, next) {
    console.error(err);

    if (err.name === "MulterError") {
        return res.status(400).json({ message: "File upload error" });
    }

    if (err.status && err.statusCode) {
        return res.status(err.status).json({ message: err.message });
    }

    res.status(500).json({
        message: "Internal server error"
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
}

module.exports = {
    errorHandler,
    notFoundHandler,
};
