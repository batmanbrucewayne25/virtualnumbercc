-- ============================================================================
-- AUDIT FIRST: DUPLICATE WALLET DEBITS
-- ============================================================================
-- Purpose:
--   Report duplicate or inconsistent wallet debit state so reviewed rows can be
--   corrected deliberately. This script intentionally performs no UPDATE,
--   DELETE, or INSERT.
--
-- Production rule:
--   Do not auto-refund or auto-delete duplicate wallet rows. Review the result
--   sets below, decide the exact ledger ids to void/refund, then run a separate
--   reviewed correction inside a transaction.
-- ============================================================================

SELECT 'A. Duplicate debit rows by wallet_id + reference' AS audit_section;

WITH grouped AS (
  SELECT
    wt.wallet_id,
    wt.reference,
    COUNT(*) AS ledger_row_count,
    COUNT(*) FILTER (
      WHERE wt.debit_status = 'success' OR wt.debit_status IS NULL
    ) AS successful_debit_count,
    MIN(wt.amount) AS expected_single_amount,
    SUM(wt.amount) FILTER (
      WHERE wt.debit_status = 'success' OR wt.debit_status IS NULL
    ) AS successful_debit_total,
    ARRAY_AGG(wt.id ORDER BY wt.created_at, wt.id) AS ledger_ids,
    ARRAY_AGG(wt.debit_status ORDER BY wt.created_at, wt.id) AS debit_statuses,
    ARRAY_AGG(wt.created_at ORDER BY wt.created_at, wt.id) AS created_at_values
  FROM mst_wallet_transaction wt
  WHERE wt.transaction_type = 'DEBIT'
    AND wt.reference IS NOT NULL
  GROUP BY wt.wallet_id, wt.reference
)
SELECT
  wallet_id,
  reference,
  ledger_row_count,
  successful_debit_count,
  expected_single_amount,
  successful_debit_total,
  successful_debit_total - expected_single_amount AS possible_over_debit,
  ledger_ids,
  debit_statuses,
  created_at_values
FROM grouped
WHERE ledger_row_count > 1 OR successful_debit_count > 1
ORDER BY possible_over_debit DESC NULLS LAST, ledger_row_count DESC;

SELECT 'B. Non-renewal multiple successful debits by virtual_number_id' AS audit_section;

WITH debit_rows AS (
  SELECT
    wt.*,
    CASE
      WHEN wt.reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN wt.reference::uuid
      ELSE NULL
    END AS reference_transaction_id
  FROM mst_wallet_transaction wt
  WHERE wt.transaction_type = 'DEBIT'
    AND (wt.debit_status = 'success' OR wt.debit_status IS NULL)
    AND wt.virtual_number_id IS NOT NULL
)
SELECT
  dr.wallet_id,
  dr.virtual_number_id,
  COUNT(*) AS successful_debit_count,
  SUM(dr.amount) AS successful_debit_total,
  ARRAY_AGG(dr.id ORDER BY dr.created_at, dr.id) AS ledger_ids,
  ARRAY_AGG(dr.reference ORDER BY dr.created_at, dr.id) AS references,
  ARRAY_AGG(t.id ORDER BY dr.created_at, dr.id) AS transaction_ids
FROM debit_rows dr
LEFT JOIN mst_transaction t
  ON t.id = dr.reference_transaction_id
WHERE COALESCE(t.notes->>'transaction_type', '') <> 'renewal'
GROUP BY dr.wallet_id, dr.virtual_number_id
HAVING COUNT(*) > 1
ORDER BY successful_debit_count DESC, successful_debit_total DESC;

SELECT 'C. Transaction, VN, and wallet ledger inconsistencies' AS audit_section;

WITH successful_debits AS (
  SELECT
    wt.id,
    wt.wallet_id,
    wt.reference,
    wt.virtual_number_id,
    wt.amount,
    wt.created_at
  FROM mst_wallet_transaction wt
  WHERE wt.transaction_type = 'DEBIT'
    AND wt.reference IS NOT NULL
    AND (wt.debit_status = 'success' OR wt.debit_status IS NULL)
),
txn_debits AS (
  SELECT
    t.id AS transaction_id,
    t.status,
    t.razorpay_payment_id,
    t.razorpay_order_id,
    t.virtual_number_id AS transaction_virtual_number_id,
    COUNT(sd.id) AS successful_debit_count,
    SUM(sd.amount) AS successful_debit_total,
    ARRAY_AGG(sd.id ORDER BY sd.created_at, sd.id)
      FILTER (WHERE sd.id IS NOT NULL) AS wallet_transaction_ids,
    ARRAY_AGG(sd.virtual_number_id ORDER BY sd.created_at, sd.id)
      FILTER (WHERE sd.id IS NOT NULL) AS ledger_virtual_number_ids
  FROM mst_transaction t
  LEFT JOIN successful_debits sd
    ON sd.reference = t.id::text
  WHERE t.razorpay_payment_id IS NOT NULL
     OR t.virtual_number_id IS NOT NULL
     OR t.status IN ('captured', 'processing_vn', 'success')
  GROUP BY
    t.id,
    t.status,
    t.razorpay_payment_id,
    t.razorpay_order_id,
    t.virtual_number_id
)
SELECT *
FROM txn_debits
WHERE (transaction_virtual_number_id IS NOT NULL AND successful_debit_count = 0)
   OR (transaction_virtual_number_id IS NULL AND successful_debit_count > 0)
   OR successful_debit_count > 1
ORDER BY successful_debit_count DESC, transaction_id;

SELECT 'D. Stale payment fulfillment claims' AS audit_section;

SELECT
  c.razorpay_payment_id,
  c.transaction_id,
  c.status,
  c.created_at,
  c.updated_at,
  t.status AS transaction_status,
  t.virtual_number_id
FROM mst_razorpay_payment_fulfillment_claim c
LEFT JOIN mst_transaction t
  ON t.id = c.transaction_id
WHERE c.updated_at < NOW() - INTERVAL '15 minutes'
ORDER BY c.updated_at ASC;

-- ============================================================================
-- REVIEWED CORRECTION TEMPLATE (commented by design)
-- ============================================================================
-- After reviewing the audit output, use a separate reviewed transaction like:
--
-- BEGIN;
--
-- -- 1) Restore only the confirmed over-debited amount to the affected wallet.
-- -- UPDATE mst_wallet
-- -- SET balance = balance + :confirmed_refund_amount,
-- --     debit_amount = debit_amount - :confirmed_refund_amount,
-- --     last_transaction_at = NOW()
-- -- WHERE id = :wallet_id;
--
-- -- 2) Mark only the reviewed duplicate ledger ids as failed/voided.
-- -- UPDATE mst_wallet_transaction
-- -- SET debit_status = 'failed',
-- --     description = CONCAT(COALESCE(description, ''), ' | voided duplicate debit after review')
-- -- WHERE id = ANY(:reviewed_duplicate_ledger_ids::uuid[]);
--
-- -- 3) Re-run sections A-C and commit only if all reviewed inconsistencies are gone.
--
-- COMMIT;
