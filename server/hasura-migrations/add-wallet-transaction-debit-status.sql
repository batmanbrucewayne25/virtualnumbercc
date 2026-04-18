-- Ledger lifecycle for reseller wallet debits (online payment flows).
-- After apply: reload Hasura schema for mst_wallet_transaction; track debit_status if needed.

ALTER TABLE mst_wallet_transaction
  ADD COLUMN IF NOT EXISTS debit_status text;

-- Backfill: historical rows are treated as completed debits
UPDATE mst_wallet_transaction
SET debit_status = 'success'
WHERE debit_status IS NULL;

ALTER TABLE mst_wallet_transaction
  ALTER COLUMN debit_status SET DEFAULT 'success';

ALTER TABLE mst_wallet_transaction
  DROP CONSTRAINT IF EXISTS chk_mst_wallet_transaction_debit_status;
ALTER TABLE mst_wallet_transaction
  ADD CONSTRAINT chk_mst_wallet_transaction_debit_status
  CHECK (debit_status IS NULL OR debit_status IN ('pending', 'success', 'failed'));

COMMENT ON COLUMN mst_wallet_transaction.debit_status IS
  'pending=in progress or orphaned attempt; success=balance moved; failed=recorded failure (optional use)';
