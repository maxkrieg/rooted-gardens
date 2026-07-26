-- Index photos by property.
--
-- `photos` had no index beyond its PK. Two reasons this earns its keep:
--   1. The account Photos tab (task 8.1) filters `property_id IN (...)` and sorts
--      by created_at DESC — this composite covers both.
--   2. `photos.property_id` is an unindexed FK, so every `properties` delete does
--      a full seq scan of photos for the referential check, and that cost grows
--      with total photo count forever.
CREATE INDEX IF NOT EXISTS photos_property_created_idx
  ON public.photos (property_id, created_at DESC);
