-- ==========================================
-- RAW SQL: Create reseller_allowed_customer table and indexes
-- Run this in your PostgreSQL database (e.g. Hasura or psql).
-- After running: In Hasura Console, go to Data -> reseller_allowed_customer -> Track table.
-- ==========================================

CREATE TABLE IF NOT EXISTS reseller_allowed_customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES mst_reseller(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT at_least_one_identifier CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reseller_allowed_customer_reseller_email
  ON reseller_allowed_customer (reseller_id, email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reseller_allowed_customer_reseller_phone
  ON reseller_allowed_customer (reseller_id, phone) WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reseller_allowed_customer_reseller_email_unique
  ON reseller_allowed_customer (reseller_id, LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reseller_allowed_customer_reseller_phone_unique
  ON reseller_allowed_customer (reseller_id, TRIM(phone)) WHERE phone IS NOT NULL AND TRIM(phone) != '';

COMMENT ON TABLE reseller_allowed_customer IS 'Allowed emails/phones for customer onboarding when reseller.allow_existing_customer is true';
