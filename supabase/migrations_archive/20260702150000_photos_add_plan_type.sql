-- Add 'plan' to photos.type — owner/lead-managed reference photos attached to the
-- Visit Plan ahead of a visit, distinct from crew's completion photos (type='visit').
ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_type_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_type_check
  CHECK (type IN ('visit', 'how_to', 'customer_request', 'before', 'after', 'plan'));
