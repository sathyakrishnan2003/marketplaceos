-- Adds fields required by the completed feature set. Applied by scripts/setup.js,
-- which tolerates "duplicate column" errors so this is safe to re-run.
ALTER TABLE products ADD COLUMN tag VARCHAR(60) NULL;

ALTER TABLE vendors ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE orders ADD COLUMN shipping_name VARCHAR(160) NULL;
ALTER TABLE orders ADD COLUMN shipping_address VARCHAR(400) NULL;
ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE orders MODIFY COLUMN status ENUM('pending','paid','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending';

ALTER TABLE escrow_transactions ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'sandbox';
ALTER TABLE escrow_transactions ADD COLUMN reference VARCHAR(120) NULL;
ALTER TABLE escrow_transactions ADD COLUMN refunded_at TIMESTAMP NULL;
ALTER TABLE escrow_transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
