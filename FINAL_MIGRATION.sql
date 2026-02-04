-- ==========================================
-- FINAL MIGRATION: Safe to run multiple times
-- ==========================================

-- Drop existing index if it exists (in case of partial creation)
DROP INDEX IF EXISTS idx_transaction_razorpay_payment_id_unique;

-- Create UNIQUE index (blocks duplicate razorpay_payment_id)
CREATE UNIQUE INDEX idx_transaction_razorpay_payment_id_unique
ON mst_transaction(razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;

-- Create webhook events table (IF NOT EXISTS is safe)
CREATE TABLE IF NOT EXISTS mst_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  reseller_id UUID NOT NULL REFERENCES mst_reseller(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES mst_transaction(id) ON DELETE SET NULL,
  event_type TEXT,
  payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON mst_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_reseller_id ON mst_webhook_events(reseller_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_transaction_id ON mst_webhook_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON mst_webhook_events(processed_at);

-- Composite index for pending transaction lookups
CREATE INDEX IF NOT EXISTS idx_transaction_pending_lookup 
ON mst_transaction(customer_id, reseller_id, status, amount)
WHERE status = 'pending' AND razorpay_payment_id IS NULL;

-- Verify everything was created
SELECT 'UNIQUE INDEX' as type, indexname as name 
FROM pg_indexes 
WHERE indexname = 'idx_transaction_razorpay_payment_id_unique'
UNION ALL
SELECT 'TABLE', 'mst_webhook_events'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mst_webhook_events')
UNION ALL
SELECT 'INDEX', indexname
FROM pg_indexes 
WHERE indexname LIKE 'idx_webhook_events_%' OR indexname = 'idx_transaction_pending_lookup';
