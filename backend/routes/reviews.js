const express = require("express");

const router = express.Router();

const {
    authenticateAndLoadUser,
    authorizeRoles
} = require("../middleware/auth");

const {
    validateReview
} = require("../middleware/validate");

const {
    getProductReviews,
    createReview,
    getProductRating
} = require("../controllers/reviewController");

router.get("/product/:productId", getProductReviews);
router.get("/product/:productId/rating", getProductRating);

router.post("/", authenticateAndLoadUser, validateReview, createReview);

module.exports = router;
