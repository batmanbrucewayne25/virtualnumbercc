-- Optional dedicated Aadhaar photo on customer (UI prefers this over profile_image when set).
-- Run against your DB, then track in Hasura if needed.
ALTER TABLE public.mst_customer
  ADD COLUMN IF NOT EXISTS aadhar_photo TEXT;

COMMENT ON COLUMN public.mst_customer.aadhar_photo IS 'Aadhaar image (base64/data URL/filename); detail pages use aadhar_photo first, then profile_image';
