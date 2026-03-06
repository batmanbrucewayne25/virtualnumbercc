-- ==========================================
-- MIGRATION: Add allow_existing_customer to mst_reseller
-- Purpose: Reseller profile "Allow Existing Customer" toggle
-- Date: 2026-02-26
-- ==========================================

-- Add column if it doesn't exist (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mst_reseller' AND column_name = 'allow_existing_customer'
  ) THEN
    ALTER TABLE mst_reseller
    ADD COLUMN allow_existing_customer BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
