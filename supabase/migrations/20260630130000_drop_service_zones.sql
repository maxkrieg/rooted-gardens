-- ─────────────────────────────────────────────────────────────────────────────
-- Eliminate service_zones entirely
--
-- service_zones sat between properties and visits to let one property carry
-- multiple named work areas, each with its own frequency (e.g. "Pool House"
-- weekly, "Tennis Court" monthly). In practice almost every property has a
-- single zone, and the extra layer added real complexity (the schedule grid
-- was built one row per zone, visits.service_zone_id was a NOT NULL FK, and
-- frequency lived only on zones). Removing the layer:
--   - frequency moves onto properties (one frequency per property)
--   - visits anchor directly to properties (one visit per property per week)
--   - the multi-frequency-per-area capability is intentionally dropped
--
-- Pre-launch: no production data, so this is a clean forward migration with
-- no data-preserving backfill required. Existing dev visits are deduped down
-- to one per (property_id, week_start) before the new uniqueness constraint
-- is added.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── frequency now lives on properties ────────────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN frequency text NOT NULL DEFAULT 'weekly'
  CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'as_needed'));

-- ─── Collapse dev data to one visit per (property × week) ────────────────────
-- Former zone-per-property test data may have produced multiple visits for
-- the same property in the same week (one per zone). Keep the most recently
-- updated row per (property_id, week_start). visit_crew rows for the dropped
-- visits cascade via their ON DELETE CASCADE FK; photos and time_entries do
-- not cascade, so detach/clear them first.
WITH doomed AS (
  SELECT v.id
  FROM public.visits v
  JOIN public.visits v2
    ON v.property_id = v2.property_id
   AND v.week_start = v2.week_start
   AND v.id <> v2.id
   AND (v.updated_at, v.id) < (v2.updated_at, v2.id)
)
UPDATE public.time_entries SET visit_id = NULL
WHERE visit_id IN (SELECT id FROM doomed);

WITH doomed AS (
  SELECT v.id
  FROM public.visits v
  JOIN public.visits v2
    ON v.property_id = v2.property_id
   AND v.week_start = v2.week_start
   AND v.id <> v2.id
   AND (v.updated_at, v.id) < (v2.updated_at, v2.id)
)
UPDATE public.photos SET visit_id = NULL
WHERE visit_id IN (SELECT id FROM doomed);

DELETE FROM public.visits v
USING public.visits v2
WHERE v.property_id = v2.property_id
  AND v.week_start = v2.week_start
  AND v.id <> v2.id
  AND (v.updated_at, v.id) < (v2.updated_at, v2.id);

-- ─── visits anchor directly to properties; drop the zone FK/column ───────────
ALTER TABLE public.visits DROP COLUMN service_zone_id;

-- ─── enforce the new core invariant: one visit per (property × week) ─────────
CREATE UNIQUE INDEX visits_property_week_idx ON public.visits (property_id, week_start);

-- ─── drop service_zones (CASCADE removes its policies, trigger, grants) ──────
DROP TABLE public.service_zones CASCADE;
