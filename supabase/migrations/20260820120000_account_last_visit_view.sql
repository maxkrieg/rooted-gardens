-- One row per account with the date of its most recent completed visit.
--
-- The accounts list previously derived this in JS from `select('account_id, ended_at')`
-- over the whole visits table with no limit — every completed visit, ever. That is both
-- unusable as an offline cache (the client-first accounts page persists its queries to
-- IndexedDB) and already subtly wrong: PostgREST caps the response at ~1000 rows, so an
-- account whose last visit fell past the cutoff silently rendered "no visits".
--
-- security_invoker is not optional. Without it a view executes with its owner's rights and
-- bypasses RLS on visits, which would expose visit dates to any role that can read the view.
CREATE OR REPLACE VIEW public.account_last_visit
WITH (security_invoker = true) AS
SELECT DISTINCT ON (account_id)
  account_id,
  ended_at AS last_visit_at
FROM public.visits
WHERE ended_at IS NOT NULL
ORDER BY account_id, ended_at DESC;

COMMENT ON VIEW public.account_last_visit IS
  'Most recent completed-visit date per account. Feeds the accounts list; RLS-respecting.';

-- DISTINCT ON (account_id) ... ORDER BY account_id, ended_at DESC is a per-account
-- descending scan; this index lets it walk the index instead of sorting the table.
CREATE INDEX IF NOT EXISTS visits_account_ended_at_idx
  ON public.visits (account_id, ended_at DESC)
  WHERE ended_at IS NOT NULL;

GRANT SELECT ON public.account_last_visit TO authenticated;
