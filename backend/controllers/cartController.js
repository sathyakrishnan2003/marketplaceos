const db = require('../config/db');

exports.getCart = async (req, res) => {
  const [items] = await db.query(`SELECT ci.product_id, ci.quantity, p.name, p.price, p.image, v.business_name AS vendor
    FROM cart_items ci JOIN products p ON p.id = ci.product_id JOIN vendors v ON v.id = p.vendor_id
    WHERE ci.user_id = ? AND p.deleted_at IS NULL`, [req.user.id]);
  res.json(items);
};

exports.addToCart = async (req, res) => {
  const quantity = Number(req.body.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: 'Quantity must be a positive integer' });
  const [products] = await db.query('SELECT id, stock FROM products WHERE id = ? AND status = \'active\' AND deleted_at IS NULL', [req.body.product_id]);
  if (!products.length || products[0].stock < quantity) return res.status(400).json({ message: 'Product is unavailable or out of stock' });
  await db.query(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`, [req.user.id, req.body.product_id, quantity]);
  res.status(201).json({ message: 'Product added to cart' });
};

exports.removeFromCart = async (req, res) => {
  await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
  res.json({ message: 'Product removed from cart' });
};
