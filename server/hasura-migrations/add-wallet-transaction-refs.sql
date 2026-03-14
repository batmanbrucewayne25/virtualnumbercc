-- Add optional customer_id and virtual_number_id to mst_wallet_transaction
-- These allow the wallet page to display which customer/virtual number a transaction relates to.

ALTER TABLE mst_wallet_transaction
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS virtual_number_id uuid;

-- After running this migration:
-- 1. In Hasura Console, go to Data > mst_wallet_transaction and reload the schema (or re-track the table)
-- 2. Add an Object Relationship named "mst_customer":
--      mst_wallet_transaction.customer_id  ->  mst_customer.id
-- 3. Add an Object Relationship named "mst_virtual_number":
--      mst_wallet_transaction.virtual_number_id  ->  mst_virtual_number.id
-- 4. Set permissions for the roles that need to read these fields (e.g. admin, reseller)
