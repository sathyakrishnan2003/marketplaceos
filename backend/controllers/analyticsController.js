const db = require('../config/db');

exports.getSummary = async (req, res) => {
  try {
    const [[summary]] = await db.query(`SELECT
      COALESCE(SUM(total_amount), 0) AS gross_merchandise_value,
      COUNT(*) AS total_orders,
      COALESCE(SUM(CASE WHEN status IN ('paid','shipped') THEN total_amount ELSE 0 END), 0) AS active_order_value
      FROM orders WHERE status <> 'cancelled' AND status <> 'refunded'`);
    const [[escrow]] = await db.query(`SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS orders FROM escrow_transactions WHERE status = 'held'`);
    const [[vendors]] = await db.query("SELECT COUNT(*) AS active_vendors FROM vendors WHERE status = 'approved'");
    const [topVendors] = await db.query(`SELECT v.id, v.business_name,
      COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS items_sold,
      COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * oi.unit_price ELSE 0 END), 0) AS revenue
      FROM vendors v LEFT JOIN order_items oi ON oi.vendor_id = v.id LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND o.status <> 'refunded'
      GROUP BY v.id, v.business_name ORDER BY revenue DESC LIMIT 10`);
    res.json({ summary, escrow, vendors, top_vendors: topVendors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
};

exports.getVendorSummary = async (req, res) => {
  try {
    const [[summary]] = await db.query(`SELECT COUNT(DISTINCT o.id) AS orders,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
      COALESCE(SUM(oi.quantity), 0) AS units_sold
      FROM vendors v JOIN order_items oi ON oi.vendor_id = v.id
      JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND o.status <> 'refunded'
      WHERE v.user_id = ?`, [req.user.id]);
    const [[products]] = await db.query(`SELECT COUNT(*) AS active_products FROM products p
      JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ? AND p.status = 'active' AND p.deleted_at IS NULL`, [req.user.id]);
    const [[escrow]] = await db.query(`SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS amount
      FROM vendors v JOIN order_items oi ON oi.vendor_id = v.id JOIN orders o ON o.id = oi.order_id
      JOIN escrow_transactions e ON e.order_id = o.id WHERE v.user_id = ? AND e.status = 'held'`, [req.user.id]);
    res.json({ summary, products, escrow });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load vendor analytics' });
  }
};

exports.getTimeSeries = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    else if (range === 'all') days = 365;

    const [data] = await db.query(
      `SELECT DATE(o.created_at) AS date,
              COUNT(*) AS orders,
              COALESCE(SUM(o.total_amount), 0) AS gmv,
              COALESCE(SUM(e.amount), 0) AS escrow
       FROM orders o
       LEFT JOIN escrow_transactions e ON e.order_id = o.id
       WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND o.status <> 'cancelled' AND o.status <> 'refunded'
       GROUP BY DATE(o.created_at)
       ORDER BY date ASC`,
      [days]
    );

    const series = generateDateSeries(days);
    const byDate = {};
    data.forEach((row) => {
      byDate[row.date.toISOString().split('T')[0]] = row;
    });

    const timeSeries = series.map((date) => {
      const day = byDate[date] || { orders: 0, gmv: 0, escrow: 0 };
      return {
        date,
        orders: Number(day.orders),
        gmv: Number(day.gmv),
        escrow: Number(day.escrow)
      };
    });

    res.json({ range, days, series: timeSeries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load time-series analytics' });
  }
};

exports.getVendorTimeSeries = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    else if (range === 'all') days = 365;

    const [data] = await db.query(
      `SELECT DATE(o.created_at) AS date,
              COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(oi.quantity), 0) AS units,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN vendors v ON v.id = oi.vendor_id
       WHERE v.user_id = ?
       AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND o.status <> 'cancelled' AND o.status <> 'refunded'
       GROUP BY DATE(o.created_at)
       ORDER BY date ASC`,
      [req.user.id, days]
    );

    const series = generateDateSeries(days);
    const byDate = {};
    data.forEach((row) => {
      byDate[row.date.toISOString().split('T')[0]] = row;
    });

    const timeSeries = series.map((date) => {
      const day = byDate[date] || { orders: 0, units: 0, revenue: 0 };
      return {
        date,
        orders: Number(day.orders),
        units: Number(day.units),
        revenue: Number(day.revenue)
      };
    });

    res.json({ range, days, series: timeSeries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load vendor time-series' });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const [rows] = await db.query(
      `SELECT p.id, p.name, v.business_name AS vendor,
              COALESCE(SUM(oi.quantity), 0) AS units_sold,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
              COALESCE(AVG(r.rating), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND o.status <> 'refunded'
       LEFT JOIN reviews r ON r.product_id = p.id
       WHERE p.deleted_at IS NULL AND p.status = 'active'
       GROUP BY p.id, p.name, v.business_name
       ORDER BY revenue DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load top products' });
  }
};

exports.getTopCategories = async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const [rows] = await db.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(oi.quantity), 0) AS units_sold,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
              COUNT(DISTINCT p.id) AS products
       FROM categories c
       JOIN products p ON p.category_id = c.id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND o.status <> 'refunded'
       WHERE p.deleted_at IS NULL AND p.status = 'active'
       GROUP BY c.id, c.name
       ORDER BY revenue DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load top categories' });
  }
};

exports.getVendorPerformance = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT v.id, v.business_name, v.status,
             COUNT(o.id) AS orders,
             COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
             COALESCE(SUM(oi.quantity), 0) AS units_sold,
             COALESCE(SUM(CASE WHEN e.status = 'held' THEN e.amount ELSE 0 END), 0) AS escrow_held
      FROM vendors v
      LEFT JOIN order_items oi ON oi.vendor_id = v.id
      LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled' AND o.status <> 'refunded'
      LEFT JOIN escrow_transactions e ON e.order_id = o.id
      GROUP BY v.id, v.business_name, v.status
      ORDER BY revenue DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load vendor performance' });
  }
};

function generateDateSeries(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
