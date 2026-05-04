-- Run in psql against your app database to verify production invariants from the wallet-debit fix plan.
-- Expect: one row per check with ok = true.
--
-- ORDER: Run AFTER applying add-wallet-transaction-unique-constraint.sql and add-razorpay-payment-fulfillment-claim.sql.
-- Incident closure: all rows must show ok = true in production before declaring duplicate-debit fixed.

-- 1) Unique ledger per (wallet_id, reference) when reference is not null
SELECT
  'uq_wallet_txn_wallet_reference' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mst_wallet_transaction'
      AND c.conname = 'uq_wallet_txn_wallet_reference'
  ) AS missing,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON c.conrelid = rel.oid
      WHERE rel.relname = 'mst_wallet_transaction'
        AND c.conname = 'uq_wallet_txn_wallet_reference'
    ) THEN true
    ELSE false
  END AS ok;

-- 2) debit_status column on wallet transactions
SELECT
  'mst_wallet_transaction.debit_status' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mst_wallet_transaction'
      AND column_name = 'debit_status'
  ) AS missing,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mst_wallet_transaction'
      AND column_name = 'debit_status'
  ) AS ok;

-- 3) Webhook events table + unique event_id
SELECT
  'mst_webhook_events.event_id unique' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mst_webhook_events'
  ) AS missing,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mst_webhook_events'
      AND c.conname = 'mst_webhook_events_event_id_key'
  ) AS ok;

-- 4) Fulfillment claim table (new mutex)
SELECT
  'mst_razorpay_payment_fulfillment_claim' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mst_razorpay_payment_fulfillment_claim'
  ) AS missing,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mst_razorpay_payment_fulfillment_claim'
  ) AS ok;

-- 5) Fulfillment claim: PRIMARY KEY on razorpay_payment_id (unique payment mutex)
SELECT
  'mst_razorpay_payment_fulfillment_claim_pkey' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mst_razorpay_payment_fulfillment_claim'
      AND c.conname = 'mst_razorpay_payment_fulfillment_claim_pkey'
      AND c.contype = 'p'
  ) AS missing,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'mst_razorpay_payment_fulfillment_claim'
      AND c.conname = 'mst_razorpay_payment_fulfillment_claim_pkey'
      AND c.contype = 'p'
  ) AS ok;
