-- ==========================================
-- Add reseller_id to cms_pages for reseller-level CMS
-- NULL = admin page; UUID = that reseller's page
-- ==========================================

ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES mst_reseller(id);

CREATE INDEX IF NOT EXISTS idx_cms_pages_reseller_id ON cms_pages(reseller_id);

COMMENT ON COLUMN cms_pages.reseller_id IS 'NULL = admin page (shown on admin login/footer); set = reseller page (shown on that reseller ClientHub/footer)';
