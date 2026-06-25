-- Create the photos storage bucket (private — access via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  10485760,           -- 10 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects is enabled by default in Supabase.
-- get_my_role() is defined in public schema (migration 20260615020240_rls_core_crm.sql).

-- Crew, leads, and owners can upload photos
CREATE POLICY "crew can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND get_my_role() IN ('owner', 'lead', 'crew')
);

-- All authenticated staff can view photos (owners, leads, crew, accountants)
CREATE POLICY "staff can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'photos');

-- Owners and leads can delete photos (crew cannot delete their own uploads)
CREATE POLICY "owners and leads can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND get_my_role() IN ('owner', 'lead')
);
