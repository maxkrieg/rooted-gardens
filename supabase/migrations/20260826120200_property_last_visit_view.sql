-- One row per property with the date of its most recent completed visit.
--
-- planWeek() phases biweekly and monthly properties from their own last visit
-- rather than from a fixed calendar parity, so it needs this per property. The
-- existing account_last_visit view is the wrong grain: an account with two
-- properties on different cadences would phase both off whichever was done last.
--
-- Deliberately keyed on ended_at, so a *skipped* visit doesn't count as a visit.
-- Skipping means the work didn't happen, which is exactly when the property
-- should come up due again.
--
-- security_invoker is not optional. Without it the view runs with its owner's
-- rights and bypasses RLS on visits.
CREATE OR REPLACE VIEW public.property_last_visit
WITH (security_invoker = true) AS
SELECT DISTINCT ON (property_id)
  property_id,
  ended_at AS last_visit_at
FROM public.visits
WHERE ended_at IS NOT NULL
ORDER BY property_id, ended_at DESC;

COMMENT ON VIEW public.property_last_visit IS
  'Most recent completed-visit date per property. Feeds planWeek(); RLS-respecting.';

-- Lets the DISTINCT ON walk the index instead of sorting the visits table.
CREATE INDEX IF NOT EXISTS visits_property_ended_at_idx
  ON public.visits (property_id, ended_at DESC)
  WHERE ended_at IS NOT NULL;

GRANT SELECT ON public.property_last_visit TO authenticated;
