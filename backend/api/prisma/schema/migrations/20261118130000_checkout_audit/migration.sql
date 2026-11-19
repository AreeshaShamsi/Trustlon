CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(80) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(80) UNIQUE,
  amount_paise INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(24) NOT NULL DEFAULT 'CREATED',
  failure_code VARCHAR(80),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX payments_order_id_status_idx ON payments(order_id, status);
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMP(3) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TIMESTAMP(3),
  UNIQUE(order_id, product_id)
);
CREATE INDEX stock_reservations_status_expires_at_idx ON stock_reservations(status, expires_at);
CREATE TABLE escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  entry_type VARCHAR(32) NOT NULL,
  amount_paise INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX escrow_ledger_order_id_entry_type_idx ON escrow_ledger(order_id, entry_type);
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(120) NOT NULL UNIQUE,
  event VARCHAR(80) NOT NULL,
  received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP(3)
);
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cart_id UUID NOT NULL,
  step VARCHAR(20) NOT NULL DEFAULT 'ADDRESS',
  payload JSONB,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cart_id)
);
CREATE INDEX checkout_sessions_user_id_idx ON checkout_sessions(user_id);
CREATE TABLE pincode_cache (
  pincode CHAR(6) PRIMARY KEY,
  city VARCHAR(80),
  state VARCHAR(60),
  serviceable BOOLEAN,
  payload JSONB,
  expires_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX pincode_cache_expires_at_idx ON pincode_cache(expires_at);
