-- ─────────────────────────────────────────────────────────────────────────────
-- Remove 'invoiced' as a visits.status value — billing state becomes a derived
-- flag on the existing invoiced_at column, matching the convention already
-- used for "in progress" (started_at/ended_at, never a status value).
--
-- The QuickBooks push flow that would eventually WRITE status='invoiced' does
-- not exist yet (app/management/billing/*, lib/quickbooks/sync.ts are stubs).
-- The only place that ever set status='invoiced' historically was the manual
-- status dropdown in VisitDetailSheet, which set `status` alone and never
-- touched invoiced_at/qbo_invoice_id/invoice_amount — so invoiced_at cannot be
-- assumed already consistent with status='invoiced' and must be backfilled.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Backfill invoiced_at for any invoiced row that's missing it ─────────────
UPDATE public.visits
SET invoiced_at = COALESCE(invoiced_at, updated_at)
WHERE status = 'invoiced' AND invoiced_at IS NULL;

-- ─── Collapse invoiced -> completed; billing now lives only in invoiced_at ───
UPDATE public.visits SET status = 'completed' WHERE status = 'invoiced';

-- ─── Narrow the CHECK constraint ──────────────────────────────────────────────
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_status_check
  CHECK (status IN ('scheduled', 'completed', 'skipped'));

-- ─── "Completed but not yet invoiced" stays fast (mirrors visits_in_progress_idx,
--     and is exactly the query the future QBO billing queue will run) ─────────
CREATE INDEX visits_uninvoiced_idx ON public.visits (id)
  WHERE status = 'completed' AND invoiced_at IS NULL;
