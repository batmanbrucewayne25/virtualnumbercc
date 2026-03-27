-- Support contact shown to customers (Client Hub / branding)
ALTER TABLE mst_reseller
  ADD COLUMN IF NOT EXISTS support_number TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT;
