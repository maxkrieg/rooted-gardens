-- Increase photo size limit to 20MB and drop HEIC.
-- HEIC removed: browsers can't display it natively and iOS auto-converts
-- HEIC to JPEG when a photo is selected via <input type="file">, so the
-- allowlist entry serves no purpose.
UPDATE storage.buckets
SET
  file_size_limit  = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'photos';
