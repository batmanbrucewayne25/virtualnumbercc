-- ============================================================================
-- AUDIT FIRST: STUCK PAYMENT FULFILLMENT CLAIMS
-- ============================================================================
-- This script intentionally performs no DELETE or UPDATE.
--
-- The webhook service now recovers stale processing_vn locks and stale pending
-- wallet ledgers itself. Use this report to identify rows that still need
-- manual review after the service retry path has run.
-- ============================================================================

SELECT 'A. Stale fulfillment claims' AS audit_section;

SELECT
  c.razorpay_payment_id,
  c.transaction_id,
  c.reseller_id,
  c.status AS claim_status,
  c.created_at AS claim_created_at,
  c.updated_at AS claim_updated_at,
  t.status AS transaction_status,
  t.virtual_number_id,
  t.razorpay_payment_id AS transaction_payment_id,
  t.razorpay_order_id
FROM mst_razorpay_payment_fulfillment_claim c
LEFT JOIN mst_transaction t
  ON t.id = c.transaction_id
WHERE c.updated_at < NOW() - INTERVAL '15 minutes'
ORDER BY c.updated_at ASC;

SELECT 'B. Transactions stuck in processing_vn without VN' AS audit_section;

SELECT
  t.id AS transaction_id,
  t.customer_id,
  t.reseller_id,
  t.status,
  t.virtual_number_id,
  t.razorpay_payment_id,
  t.razorpay_order_id,
  t.updated_at,
  t.notes
FROM mst_transaction t
WHERE t.status = 'processing_vn'
  AND t.virtual_number_id IS NULL
ORDER BY t.updated_at ASC;

SELECT 'C. Pending wallet ledgers older than 15 minutes' AS audit_section;

SELECT
  wt.id AS wallet_transaction_id,
  wt.wallet_id,
  w.reseller_id,
  wt.reference,
  wt.virtual_number_id,
  wt.customer_id,
  wt.amount,
  wt.balance_before,
  wt.balance_after,
  wt.debit_status,
  wt.created_at,
  wt.description
FROM mst_wallet_transaction wt
JOIN mst_wallet w
  ON w.id = wt.wallet_id
WHERE wt.transaction_type = 'DEBIT'
  AND wt.debit_status = 'pending'
  AND wt.created_at < NOW() - INTERVAL '15 minutes'
ORDER BY wt.created_at ASC;

-- ============================================================================
-- REVIEWED RECOVERY TEMPLATE (commented by design)
-- ============================================================================
-- Use only after reviewing the audit output and confirming no worker is still
-- processing the payment.
--
-- BEGIN;
--
-- -- Release one reviewed stale claim.
-- -- DELETE FROM mst_razorpay_payment_fulfillment_claim
-- -- WHERE razorpay_payment_id = :reviewed_razorpay_payment_id;
--
-- -- Reset one reviewed transaction so the next payment.captured retry can
-- -- resume VN fulfillment.
-- -- UPDATE mst_transaction
-- -- SET status = 'captured'
-- -- WHERE id = :reviewed_transaction_id
-- --   AND status = 'processing_vn'
-- --   AND virtual_number_id IS NULL;
--
-- -- Do not delete pending wallet ledger rows unless you have verified the
-- -- wallet balance still equals balance_before and the CAS never happened.
--
-- COMMIT;
