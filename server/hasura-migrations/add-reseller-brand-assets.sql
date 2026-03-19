-- ==========================================
-- Add reseller brand asset fields
-- ==========================================

ALTER TABLE public.mst_reseller
  ADD COLUMN IF NOT EXISTS favicon TEXT,
  ADD COLUMN IF NOT EXISTS minified_logo TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_alt TEXT;

COMMENT ON COLUMN public.mst_reseller.favicon IS 'Reseller favicon filename or URL';
COMMENT ON COLUMN public.mst_reseller.minified_logo IS 'Reseller minified/small logo filename or URL';
COMMENT ON COLUMN public.mst_reseller.profile_image_alt IS 'Reseller alternative profile image filename or URL';
