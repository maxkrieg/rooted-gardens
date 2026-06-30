-- ─────────────────────────────────────────────────────────────────────────────
-- Collapse visit_sessions into visits
--
-- The visit_sessions table modeled crew on-site time as a one-visit-to-many-
-- sessions relationship. A prior migration (20260628220414) already reduced it to
-- a single open session per visit, so it now effectively represents one work
-- interval per visit. This migration finishes the simplification:
--   - move started_at / ended_at directly onto visits
--   - drop the redundant visits.actual_date (completion date = ended_at)
--   - drop the visit_sessions table entirely (and its RLS, indexes, triggers)
--
-- In-progress is a derived state: started_at IS NOT NULL AND ended_at IS NULL.
-- (Per the project rule, 'in_progress' is never a value of visits.status.)
-- The existing visits_update RLS policy already lets assigned crew update their
-- visit rows, so no new policies are needed for crew start/stop/finish.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Add the new columns ──────────────────────────────────────────────────────
ALTER TABLE public.visits
  ADD COLUMN started_at timestamptz,
  ADD COLUMN ended_at   timestamptz;

-- ─── Backfill from existing sessions (collapse to a single interval) ──────────
UPDATE public.visits v
SET started_at = s.min_start,
    ended_at   = s.max_end
FROM (
  SELECT visit_id,
         min(started_at) AS min_start,
         max(ended_at)   AS max_end
  FROM public.visit_sessions
  GROUP BY visit_id
) s
WHERE s.visit_id = v.id;

-- ─── "Who's on site now" stays fast ───────────────────────────────────────────
CREATE INDEX visits_in_progress_idx ON public.visits (id)
  WHERE started_at IS NOT NULL AND ended_at IS NULL;

-- ─── Drop visit_sessions (CASCADE removes its policies, indexes, triggers, FKs)─
DROP TABLE public.visit_sessions CASCADE;

-- ─── Drop the now-redundant actual_date ───────────────────────────────────────
ALTER TABLE public.visits DROP COLUMN actual_date;
