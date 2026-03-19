-- ==========================================
-- Add payment_type to wallet_request
-- Values: 'bank_transfer' | 'upi'
-- ==========================================

ALTER TABLE wallet_request
  ADD COLUMN IF NOT EXISTS payment_type TEXT;

UPDATE wallet_request
  SET payment_type = 'bank_transfer'
  WHERE payment_type IS NULL;

ALTER TABLE wallet_request
  ALTER COLUMN payment_type SET DEFAULT 'bank_transfer',
  ALTER COLUMN payment_type SET NOT NULL;

ALTER TABLE wallet_request
  DROP CONSTRAINT IF EXISTS chk_wallet_request_payment_type;

ALTER TABLE wallet_request
  ADD CONSTRAINT chk_wallet_request_payment_type
  CHECK (payment_type IN ('bank_transfer', 'upi'));

COMMENT ON COLUMN wallet_request.payment_type IS 'Payment method: bank_transfer or upi';
