-- ============================================================================
-- AUDIT: WALLET BALANCE VS WALLET LEDGER
-- ============================================================================
-- Set params.reseller_id to a specific reseller UUID to narrow the report, or
-- leave it NULL to audit every wallet.
-- This script is read-only.
-- ============================================================================

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT 'A. Current wallet rows' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT
  w.id AS wallet_id,
  w.reseller_id,
  w.balance,
  w.debit_amount,
  w.last_transaction_at
FROM mst_wallet w
CROSS JOIN params p
WHERE p.reseller_id IS NULL OR w.reseller_id = p.reseller_id
ORDER BY w.reseller_id, w.id;

SELECT 'B. Successful debit ledger totals' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT
  w.id AS wallet_id,
  w.reseller_id,
  COUNT(wt.id) AS successful_debit_rows,
  COALESCE(SUM(wt.amount), 0) AS successful_debit_total,
  w.debit_amount AS wallet_debit_amount,
  w.debit_amount - COALESCE(SUM(wt.amount), 0) AS debit_amount_minus_ledger
FROM mst_wallet w
CROSS JOIN params p
LEFT JOIN mst_wallet_transaction wt
  ON wt.wallet_id = w.id
 AND wt.transaction_type = 'DEBIT'
 AND (wt.debit_status = 'success' OR wt.debit_status IS NULL)
WHERE p.reseller_id IS NULL OR w.reseller_id = p.reseller_id
GROUP BY w.id, w.reseller_id, w.debit_amount
ORDER BY ABS(w.debit_amount - COALESCE(SUM(wt.amount), 0)) DESC, w.reseller_id;

SELECT 'C. Pending or failed debit ledger rows requiring review' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT
  wt.id,
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
CROSS JOIN params p
WHERE wt.transaction_type = 'DEBIT'
  AND wt.debit_status IN ('pending', 'failed')
  AND (p.reseller_id IS NULL OR w.reseller_id = p.reseller_id)
ORDER BY wt.created_at ASC;

SELECT 'D. All debit rows for detailed review' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT
  wt.id,
  wt.created_at,
  wt.wallet_id,
  w.reseller_id,
  wt.reference,
  wt.virtual_number_id,
  wt.customer_id,
  wt.transaction_type,
  wt.debit_status,
  wt.amount,
  wt.balance_before,
  wt.balance_after,
  wt.description
FROM mst_wallet_transaction wt
JOIN mst_wallet w
  ON w.id = wt.wallet_id
CROSS JOIN params p
WHERE wt.transaction_type = 'DEBIT'
  AND (p.reseller_id IS NULL OR w.reseller_id = p.reseller_id)
ORDER BY w.reseller_id, wt.created_at ASC, wt.id;

SELECT 'E. Wallet balance drift from credit ledger minus success debit ledger' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
),
ledger AS (
  SELECT
    w.id AS wallet_id,
    w.reseller_id,
    w.balance AS stored_balance,
    w.credit_amount AS wallet_credit_amount,
    COALESCE(SUM(CASE WHEN wt.transaction_type = 'CREDIT' THEN wt.amount ELSE 0 END), 0) AS ledger_credit_total,
    COALESCE(SUM(CASE WHEN wt.transaction_type = 'DEBIT' AND (wt.debit_status = 'success' OR wt.debit_status IS NULL) THEN wt.amount ELSE 0 END), 0) AS ledger_success_debit_total
  FROM mst_wallet w
  CROSS JOIN params p
  LEFT JOIN mst_wallet_transaction wt
    ON wt.wallet_id = w.id
  WHERE p.reseller_id IS NULL OR w.reseller_id = p.reseller_id
  GROUP BY w.id, w.reseller_id, w.balance
)
SELECT
  wallet_id,
  reseller_id,
  stored_balance,
  wallet_credit_amount,
  ledger_credit_total,
  ledger_success_debit_total,
  COALESCE(NULLIF(ledger_credit_total, 0), wallet_credit_amount, 0) - ledger_success_debit_total AS expected_balance_from_ledger,
  stored_balance - (COALESCE(NULLIF(ledger_credit_total, 0), wallet_credit_amount, 0) - ledger_success_debit_total) AS stored_minus_expected
FROM ledger
WHERE ABS(stored_balance - (COALESCE(NULLIF(ledger_credit_total, 0), wallet_credit_amount, 0) - ledger_success_debit_total)) > 0.0001
ORDER BY ABS(stored_balance - (COALESCE(NULLIF(ledger_credit_total, 0), wallet_credit_amount, 0) - ledger_success_debit_total)) DESC;

SELECT 'F. Wallet debits missing VN link while transaction has VN' AS audit_section;

WITH params AS (
  SELECT NULL::uuid AS reseller_id
)
SELECT
  wt.id AS wallet_transaction_id,
  wt.wallet_id,
  w.reseller_id,
  wt.reference,
  wt.customer_id,
  wt.virtual_number_id AS wallet_virtual_number_id,
  t.virtual_number_id AS transaction_virtual_number_id,
  wt.amount,
  wt.debit_status,
  wt.created_at
FROM mst_wallet_transaction wt
JOIN mst_wallet w
  ON w.id = wt.wallet_id
JOIN mst_transaction t
  ON t.id::text = wt.reference
CROSS JOIN params p
WHERE wt.transaction_type = 'DEBIT'
  AND (wt.debit_status = 'success' OR wt.debit_status IS NULL)
  AND wt.virtual_number_id IS NULL
  AND t.virtual_number_id IS NOT NULL
  AND (p.reseller_id IS NULL OR w.reseller_id = p.reseller_id)
ORDER BY wt.created_at DESC;
