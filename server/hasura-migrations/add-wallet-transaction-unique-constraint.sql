-- Add unique constraint on (wallet_id, reference) for mst_wallet_transaction
-- Prevents duplicate wallet debits when the same payment webhook is processed concurrently.
-- Idempotent: drops existing constraint/index first, then recreates.
--
-- ROLLOUT: Apply this in Postgres BEFORE or ahead of deploying CAS-loop idempotency code
-- in the API. Verify with VERIFY_WALLET_DEBIT_INVARIANTS.sql (check 1) until ok = true.

-- Drop constraint (removes its index too)
ALTER TABLE mst_wallet_transaction DROP CONSTRAINT IF EXISTS uq_wallet_txn_wallet_reference;

-- Drop standalone index if it exists (e.g. created via CREATE UNIQUE INDEX)
DROP INDEX IF EXISTS uq_wallet_txn_wallet_reference;

-- Add the constraint
ALTER TABLE mst_wallet_transaction
  ADD CONSTRAINT uq_wallet_txn_wallet_reference UNIQUE (wallet_id, reference);
