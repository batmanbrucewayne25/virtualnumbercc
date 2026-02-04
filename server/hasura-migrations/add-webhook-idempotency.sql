-- ==========================================
-- MIGRATION: Add Webhook Idempotency and Transaction Constraints
-- Purpose: Prevent duplicate transactions at DATABASE level
-- Date: 2026-02-04
-- ==========================================

-- STEP 1: Add unique index on razorpay_payment_id (partial index to exclude NULLs)
-- This FORCES database to reject duplicate transactions with same payment ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_razorpay_payment_id_unique
ON mst_transaction(razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;

-- STEP 2: Create webhook events table for idempotency
-- Tracks all processed webhook events to prevent re-processing
CREATE TABLE IF NOT EXISTS mst_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE, -- Razorpay event ID (event_...)
  reseller_id UUID NOT NULL REFERENCES mst_reseller(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES mst_transaction(id) ON DELETE SET NULL,
  event_type TEXT, -- payment.captured, payment.authorized, etc.
  payload JSONB, -- Full webhook payload for audit
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON mst_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_reseller_id ON mst_webhook_events(reseller_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_transaction_id ON mst_webhook_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON mst_webhook_events(processed_at);

-- STEP 3: Index already created in STEP 1 (unique index serves as regular index too)

-- STEP 4: Add composite index for finding pending transactions faster
CREATE INDEX IF NOT EXISTS idx_transaction_pending_lookup 
ON mst_transaction(customer_id, reseller_id, status, amount)
WHERE status = 'pending' AND razorpay_payment_id IS NULL;

-- ==========================================
-- ROLLBACK SCRIPT (if needed)
-- ==========================================
--
-- DROP INDEX IF EXISTS idx_transaction_razorpay_payment_id_unique;
-- DROP TABLE IF EXISTS mst_webhook_events CASCADE;
-- DROP INDEX IF EXISTS idx_transaction_pending_lookup;
