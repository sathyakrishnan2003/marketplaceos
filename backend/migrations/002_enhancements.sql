-- Adds tables and columns introduced after the initial schema.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS and ALTER TABLE ... ADD COLUMN
-- tolerate "duplicate" errors because scripts/setup.js ignores them.
-- For existing databases without a rebuild, this migration applies the
-- order_items fulfillment fields and the audit + refresh-token tables.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  actor_user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  from_state VARCHAR(20) NULL,
  to_state VARCHAR(20) NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP NULL;
ALTER TABLE order_items ADD COLUMN status ENUM('pending','shipped','delivered') NOT NULL DEFAULT 'pending';
ALTER TABLE order_items ADD COLUMN tracking_number VARCHAR(120) NULL;
