-- Payment-scoped mutex for Razorpay payment.captured fulfillment.
-- First INSERT wins; concurrent webhook workers get ON CONFLICT DO NOTHING (affected_rows=0).
-- Track in Hasura: Data > mst_razorpay_payment_fulfillment_claim > Track table
-- Permissions: service role / admin secret only recommended.

CREATE TABLE IF NOT EXISTS mst_razorpay_payment_fulfillment_claim (
  razorpay_payment_id TEXT NOT NULL PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES mst_reseller(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_payment_fulfillment_claim_reseller
  ON mst_razorpay_payment_fulfillment_claim (reseller_id);

COMMENT ON TABLE mst_razorpay_payment_fulfillment_claim IS
  'Insert-first claim for webhook fulfillment per Razorpay payment id; prevents duplicate post-payment / wallet debits across concurrent workers.';
