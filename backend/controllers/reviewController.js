const db = require('../config/db');

exports.getProductReviews = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [[meta]] = await db.query(
      `SELECT COUNT(*) AS total FROM reviews WHERE product_id = ?`,
      [productId]
    );

    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [productId, limit, offset]
    );

    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total: meta.total,
        pages: Math.ceil(meta.total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

exports.createReview = async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }
  try {
    const [eligible] = await db.query(
      `SELECT oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND o.id = ? AND o.user_id = ? AND o.status = 'delivered'`,
      [req.body.product_id, req.body.order_id, req.user.id]
    );
    if (!eligible.length) {
      return res.status(403).json({ message: 'Only delivered purchases can be reviewed' });
    }

    await db.query(
      `INSERT INTO reviews (user_id, product_id, order_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.body.product_id, req.body.order_id, rating, req.body.comment || null]
    );
    res.status(201).json({ message: 'Review published' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This purchase has already been reviewed' });
    }
    console.error(error);
    res.status(500).json({ message: 'Failed to publish review' });
  }
};

exports.getProductRating = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COALESCE(AVG(rating), 0) AS avg_rating,
              COUNT(*) AS review_count
       FROM reviews WHERE product_id = ?`,
      [req.params.productId]
    );
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch rating' });
  }
};
