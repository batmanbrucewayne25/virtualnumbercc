-- Add unique constraint on (wallet_id, reference) for mst_wallet_transaction
-- Prevents duplicate wallet debits when the same payment webhook is processed concurrently.
-- Idempotent: drops existing constraint/index first, then recreates.

-- Drop constraint (removes its index too)
ALTER TABLE mst_wallet_transaction DROP CONSTRAINT IF EXISTS uq_wallet_txn_wallet_reference;

-- Drop standalone index if it exists (e.g. created via CREATE UNIQUE INDEX)
DROP INDEX IF EXISTS uq_wallet_txn_wallet_reference;

-- Add the constraint
ALTER TABLE mst_wallet_transaction
  ADD CONSTRAINT uq_wallet_txn_wallet_reference UNIQUE (wallet_id, reference);
