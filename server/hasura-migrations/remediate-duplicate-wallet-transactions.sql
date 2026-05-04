-- Data remediation: find duplicate DEBIT rows sharing the same (wallet_id, reference).
-- Run VERIFY_WALLET_DEBIT_INVARIANTS.sql first; apply uq_wallet_txn_wallet_reference BEFORE relying on this in prod
-- (or run in a transaction that adds the constraint after cleanup).

-- A) Inspect duplicates (read-only) — review output before changing data
SELECT
  wallet_id,
  reference,
  COUNT(*) AS row_count,
  SUM(amount::numeric) AS total_amount,
  ARRAY_AGG(id ORDER BY created_at ASC) AS txn_ids_oldest_first
FROM mst_wallet_transaction
WHERE transaction_type = 'DEBIT'
  AND reference IS NOT NULL
  AND reference <> ''
GROUP BY wallet_id, reference
HAVING COUNT(*) > 1;

-- B) Example: keep oldest row per (wallet_id, reference), mark extras as failed (adjust IDs from query A).
-- Uncomment and replace UUIDs after your audit.

-- UPDATE mst_wallet_transaction
-- SET debit_status = 'failed',
--     description = COALESCE(description, '') || ' [voided duplicate of same payment reference]'
-- WHERE id IN (
--   'REPLACE_WITH_DUPLICATE_ROW_UUID_2',
--   'REPLACE_WITH_DUPLICATE_ROW_UUID_3'
-- );

-- C) Wallet balance correction (example): if reseller was debited N times but should be 1x, add back (N-1)*amount
-- as a CREDIT admin adjustment, or set balance via controlled UPDATE — coordinate with finance.
-- This is intentionally not automated; use your business rules.
