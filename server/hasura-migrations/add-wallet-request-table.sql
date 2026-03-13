-- ==========================================
-- MIGRATION: Create wallet_request table
-- Purpose: Reseller requests for wallet credit; admin approves or rejects
-- Date: 2026-02-26
-- After running: In Hasura Console, track wallet_request and set permissions.
-- ==========================================

CREATE TABLE IF NOT EXISTS wallet_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES mst_reseller(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES mst_super_admin(id),
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_wallet_request_reseller_id ON wallet_request(reseller_id);
CREATE INDEX IF NOT EXISTS idx_wallet_request_status ON wallet_request(status);
CREATE INDEX IF NOT EXISTS idx_wallet_request_created_at ON wallet_request(created_at DESC);

COMMENT ON TABLE wallet_request IS 'Reseller requests for wallet credit; admin approves or rejects';
