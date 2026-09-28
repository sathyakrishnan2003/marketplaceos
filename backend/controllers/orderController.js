const db = require('../config/db');

async function logOrderAudit(connection, orderId, actorUserId, fromState, toState, note) {
    await connection.query(
        `INSERT INTO order_audit (order_id, actor_user_id, action, from_state, to_state, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, actorUserId, `${fromState || 'init'}->${toState || 'none'}`, fromState, toState, note]
    );
}

exports.createOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.query(`SELECT ci.product_id, ci.quantity, p.price, p.stock, p.vendor_id
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ? FOR UPDATE`, [req.user.id]);
    if (!items.length) return res.status(400).json({ message: 'Cart is empty' });
    if (items.some((item) => item.stock < item.quantity)) return res.status(400).json({ message: 'One or more products are out of stock' });
    const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    const idempotencyKey = req.body.idempotency_key;
    if (idempotencyKey) {
      const [[existing]] = await connection.query(
        `SELECT id, total_amount, status FROM orders WHERE id = ?`,
        [idempotencyKey]
      );
      if (existing) {
        const [[escrow]] = await connection.query(
          `SELECT status AS escrow_status FROM escrow_transactions WHERE order_id = ?`,
          [existing.id]
        );
        await connection.commit();
        return res.json({
          id: existing.id,
          total_amount: existing.total_amount,
          status: existing.status,
          escrow_status: escrow?.escrow_status || 'held'
        });
      }
    }

    const [order] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'paid')`,
      [req.user.id, total]
    );

    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, vendor_id, quantity, unit_price, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [order.insertId, item.product_id, item.vendor_id, item.quantity, item.price]
      );
      await connection.query(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    const reference = `ord_${order.insertId}_${Date.now()}`;
    await connection.query(
      `INSERT INTO escrow_transactions (order_id, amount, provider, reference, status)
       VALUES (?, ?, 'sandbox', ?, 'held')`,
      [order.insertId, total, reference]
    );

    await connection.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    await logOrderAudit(connection, order.insertId, req.user.id, null, 'paid', 'Order created and payment held in sandbox escrow');

    await connection.commit();
    res.status(201).json({
      id: order.insertId,
      total_amount: total,
      status: 'paid',
      escrow_status: 'held'
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    connection.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.id, o.total_amount, o.status, o.created_at, o.updated_at,
             e.status AS escrow_status, e.provider, e.released_at
      FROM orders o
      LEFT JOIN escrow_transactions e ON e.order_id = o.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const [[order]] = await db.query(`
      SELECT o.id, o.user_id, o.total_amount, o.status, o.created_at, o.updated_at,
             o.shipping_name, o.shipping_address, o.shipped_at,
             e.status AS escrow_status, e.amount AS escrow_amount,
             e.provider, e.reference, e.released_at, e.refunded_at
      FROM orders o
      LEFT JOIN escrow_transactions e ON e.order_id = o.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isOwner = order.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    let vendorId = null;
    if (req.user.role === 'vendor') {
      const [[vi]] = await db.query(
        `SELECT id FROM vendors WHERE user_id = ?`,
        [req.user.id]
      );
      vendorId = vi ? vi.id : null;
    }

    if (!isOwner && !isAdmin && !vendorId) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    if (vendorId && !isOwner && !isAdmin) {
      const [orderItems] = await db.query(
        `SELECT COUNT(*) AS cnt FROM order_items WHERE order_id = ? AND vendor_id = ?`,
        [orderId, vendorId]
      );
      if (!orderItems[0].cnt) {
        return res.status(403).json({ message: 'Not authorized to view this order' });
      }
    }

    const [items] = await db.query(`
      SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.status AS item_status,
             p.name AS product_name, p.image AS product_image,
             v.business_name AS vendor_name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN vendors v ON v.id = oi.vendor_id
      WHERE oi.order_id = ?
    `, [orderId]);

    const [events] = await db.query(
      `SELECT action, from_state, to_state, note, created_at
       FROM order_audit
       WHERE order_id = ?
       ORDER BY created_at ASC`,
      [orderId]
    );

    res.json({
      ...order,
      items,
      events
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
    const [[vendor]] = await db.query(
      `SELECT id FROM vendors WHERE user_id = ?`,
      [req.user.id]
    );

    if (!vendor) {
      return res.status(403).json({ message: 'Vendor profile not found' });
    }

    const [orders] = await db.query(`
      SELECT DISTINCT o.id, o.total_amount, o.status, o.created_at, o.updated_at,
             e.status AS escrow_status,
             oi.quantity AS items_ordered,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND vendor_id = ?) AS vendor_items,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND vendor_id = ? AND status = 'shipped') AS items_shipped
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN escrow_transactions e ON e.order_id = o.id
      WHERE oi.vendor_id = ?
      ORDER BY o.created_at DESC
    `, [vendor.id, vendor.id, vendor.id]);

    res.json(orders);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch vendor orders' });
  }
};

exports.markShipped = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = req.params.id;
    const trackingNumber = req.body.tracking_number || null;

    const [[order]] = await connection.query(
      `SELECT id, user_id, status FROM orders WHERE id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let vendorId = null;
    if (req.user.role === 'vendor') {
      const [[v]] = await connection.query(
        `SELECT id FROM vendors WHERE user_id = ?`,
        [req.user.id]
      );
      vendorId = v ? v.id : null;

      const [[ownItem]] = await connection.query(
        `SELECT id FROM order_items WHERE order_id = ? AND vendor_id = ? LIMIT 1`,
        [orderId, vendorId]
      );
      if (!ownItem) {
        await connection.rollback();
        return res.status(403).json({ message: 'Not authorized to fulfill this order' });
      }

      await connection.query(
        `UPDATE order_items SET status = 'shipped', tracking_number = ?
         WHERE order_id = ? AND vendor_id = ? AND status = 'pending'`,
        [trackingNumber, orderId, vendorId]
      );

      const [[remaining]] = await connection.query(
        `SELECT COUNT(*) AS pending FROM order_items WHERE order_id = ? AND status = 'pending'`,
        [orderId]
      );

      if (remaining.pending === 0 && order.status === 'paid') {
        const prevStatus = order.status;
        await connection.query(
          `UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = ?`,
          [orderId]
        );
        await logOrderAudit(connection, orderId, req.user.id, prevStatus, 'shipped', trackingNumber ? `Tracking: ${trackingNumber}` : 'Items shipped');
      }
    } else {
      const prevStatus = order.status;
      await connection.query(
        `UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = ?`,
        [orderId]
      );
      if (trackingNumber) {
        await connection.query(
          `UPDATE order_items SET status = 'shipped', tracking_number = ?
           WHERE order_id = ? AND status = 'pending'`,
          [trackingNumber, orderId]
        );
      } else {
        await connection.query(
          `UPDATE order_items SET status = 'shipped' WHERE order_id = ? AND status = 'pending'`,
          [orderId]
        );
      }
      await logOrderAudit(connection, orderId, req.user.id, prevStatus, 'shipped', 'Order marked shipped by admin');
    }

    await connection.commit();
    res.json({ message: 'Order marked as shipped' });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to mark order as shipped' });
  } finally {
    connection.release();
  }
};

exports.cancelOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = req.params.id;
    const [[order]] = await connection.query(
      `SELECT id, user_id, status FROM orders WHERE id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isOwner = order.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    const cancellable = ['pending', 'paid', 'shipped'];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({
        message: `Order cannot be cancelled from status: ${order.status}`
      });
    }

    const prevStatus = order.status;
    await connection.query(
      `UPDATE orders SET status = 'cancelled' WHERE id = ?`,
      [orderId]
    );

    const [[escrow]] = await connection.query(
      `SELECT id, status FROM escrow_transactions WHERE order_id = ?`,
      [orderId]
    );

    let escrowStatus = null;
    if (escrow && escrow.status === 'held') {
      await connection.query(
        `UPDATE escrow_transactions
         SET status = 'refunded', refunded_at = NOW()
         WHERE order_id = ?`,
        [orderId]
      );
      escrowStatus = 'refunded';
    }

    await logOrderAudit(connection, orderId, req.user.id, prevStatus, 'cancelled', `Order cancelled by ${req.user.role}`);

    await connection.commit();
    res.json({
      message: 'Order cancelled successfully',
      escrow_status: escrowStatus || escrow?.status
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to cancel order' });
  } finally {
    connection.release();
  }
};

exports.refundOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = req.params.id;
    const [[order]] = await connection.query(
      `SELECT id, total_amount, status FROM orders WHERE id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const [[escrow]] = await connection.query(
      `SELECT id, status, amount FROM escrow_transactions WHERE order_id = ?`,
      [orderId]
    );

    if (!escrow) {
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    if (escrow.status === 'refunded') {
      return res.status(400).json({ message: 'Escrow already refunded' });
    }

    const prevEscrowStatus = escrow.status;
    await connection.query(
      `UPDATE escrow_transactions
       SET status = 'refunded', refunded_at = NOW()
       WHERE order_id = ?`,
      [orderId]
    );

    const prevOrderStatus = order.status;
    if (order.status !== 'cancelled' && order.status !== 'refunded') {
      await connection.query(
        `UPDATE orders SET status = 'refunded' WHERE id = ?`,
        [orderId]
      );
    }

    await logOrderAudit(connection, orderId, req.user.id, prevOrderingState(prevOrderStatus, prevEscrowStatus), 'refunded', `Refund processed by admin`);

    await connection.commit();
    res.json({
      message: 'Order refunded successfully',
      escrow_status: 'refunded'
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to refund order' });
  } finally {
    connection.release();
  }
};

exports.adminReleaseEscrow = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = req.params.id;
    const [[escrow]] = await connection.query(
      `SELECT et.id, et.status, et.amount, o.status AS order_status
       FROM escrow_transactions et
       JOIN orders o ON o.id = et.order_id
       WHERE et.order_id = ?`,
      [orderId]
    );

    if (!escrow) {
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    if (escrow.status !== 'held') {
      return res.status(400).json({
        message: `Escrow cannot be released from status: ${escrow.status}`
      });
    }

    await connection.query(
      `UPDATE escrow_transactions
       SET status = 'released', released_at = NOW()
       WHERE order_id = ?`,
      [orderId]
    );

    if (escrow.order_status === 'pending' || escrow.order_status === 'paid' || escrow.order_status === 'shipped') {
      await connection.query(
        `UPDATE orders SET status = 'delivered' WHERE id = ?`,
        [orderId]
      );
    }

    await logOrderAudit(connection, orderId, req.user.id, 'held', 'released', 'Escrow released by admin');

    await connection.commit();
    res.json({
      message: 'Escrow released successfully',
      amount: Number(escrow.amount)
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to release escrow' });
  } finally {
    connection.release();
  }
};

exports.adminRefundEscrow = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const orderId = req.params.id;
    const [[escrow]] = await connection.query(
      `SELECT et.id, et.status, et.amount, o.status AS order_status
       FROM escrow_transactions et
       JOIN orders o ON o.id = et.order_id
       WHERE et.order_id = ?`,
      [orderId]
    );

    if (!escrow) {
      return res.status(404).json({ message: 'Escrow record not found' });
    }

    if (escrow.status === 'refunded') {
      return res.status(400).json({ message: 'Escrow already refunded' });
    }

    const prevEscrowStatus = escrow.status;
    await connection.query(
      `UPDATE escrow_transactions
       SET status = 'refunded', refunded_at = NOW()
       WHERE order_id = ?`,
      [orderId]
    );

    const prevOrderStatus = escrow.order_status;
    if (prevOrderStatus !== 'cancelled' && prevOrderStatus !== 'refunded') {
      await connection.query(
        `UPDATE orders SET status = 'refunded' WHERE id = ?`,
        [orderId]
      );
    }

    await logOrderAudit(connection, orderId, req.user.id, `${prevOrderStatus}/${prevEscrowStatus}`, `${prevOrderStatus}/refunded`, 'Escrow refunded by admin');

    await connection.commit();
    res.json({
      message: 'Escrow refunded successfully',
      amount: Number(escrow.amount)
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to refund escrow' });
  } finally {
    connection.release();
  }
};

exports.getEscrowLedger = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.id, e.order_id, e.amount, e.provider, e.reference,
             e.status, e.released_at, e.refunded_at, e.created_at,
             u.id AS customer_id, u.name AS customer_name, u.email AS customer_email,
             o.status AS order_status, o.total_amount AS order_total, o.created_at AS order_created_at,
             GROUP_CONCAT(DISTINCT v.business_name ORDER BY v.business_name SEPARATOR ', ') AS vendors
      FROM escrow_transactions e
      JOIN orders o ON o.id = e.order_id
      JOIN users u ON u.id = o.user_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN vendors v ON v.id = oi.vendor_id
      GROUP BY e.id, e.order_id, e.amount, e.provider, e.reference,
               e.status, e.released_at, e.refunded_at, e.created_at,
               u.id, u.name, u.email,
               o.status, o.total_amount, o.created_at
      ORDER BY e.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch escrow ledger' });
  }
};

function prevOrderingState(orderStatus, escrowStatus) {
    return `${orderStatus}/${escrowStatus || 'held'}`;
}

exports.confirmDelivery = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE escrow_transactions e
       JOIN orders o ON o.id = e.order_id
       SET e.status = 'released', e.released_at = NOW(), o.status = 'delivered'
       WHERE e.order_id = ? AND o.user_id = ? AND e.status = 'held'`,
      [req.params.id, req.user.id]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      const [[check]] = await connection.query(
        `SELECT o.status, e.status AS escrow_status
         FROM orders o JOIN escrow_transactions e ON e.order_id = o.id
         WHERE o.id = ?`,
        [req.params.id]
      );
      if (!check) {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(400).json({
        message: 'Order cannot be delivered at this time',
        order_status: check.status,
        escrow_status: check.escrow_status
      });
    }

    await logOrderAudit(connection, req.params.id, req.user.id, 'held', 'released', 'Delivery confirmed, escrow released');

    await connection.commit();
    res.json({ message: 'Delivery confirmed and escrow released' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Failed to confirm delivery' });
  } finally {
    connection.release();
  }
};
