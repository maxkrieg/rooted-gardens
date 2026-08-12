-- ─────────────────────────────────────────────────────────────────────────────
-- Unify invoices into one canonical table + track real QBO lifecycle status.
--
-- Until now the app treated a visit as "invoiced" the instant it was pushed to
-- QuickBooks: visits.invoiced_at + visits.qbo_invoice_id were set (per_visit),
-- or a row was inserted into contract_invoices (contract). But "invoiced" to the
-- owners means "QuickBooks actually SENT it to the customer" — a QBO-side event
-- the app never tracked, because the integration was strictly one-way (push
-- only, never pull).
--
-- This migration:
--   1. Creates a single `invoices` table — one row per QBO invoice this app has
--      ever created, for every billing type. It carries a real lifecycle
--      `status` (draft → sent → paid → overdue) synced back from QBO by a
--      polling job + a manual "Refresh now" action (the one narrow read-path
--      exception to the otherwise one-way sync).
--   2. Backfills it from the two places invoice identity used to live:
--      contract_invoices (authoritative for contract) and the qbo_invoice_id
--      scattered across visits (per_visit + legacy contract pushes).
--   3. Normalizes visits: replaces invoiced_at + qbo_invoice_id with a single
--      invoice_id FK. visits.invoice_amount stays — it's the per-line snapshot
--      (differs per visit within an invoice); invoices.amount is the total.
--   4. Drops contract_invoices (folded into invoices as period_* columns).
--
-- Runs in one transaction: if the safety check in step C fails, the whole thing
-- (including the destructive drops) rolls back to a clean, retryable state.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ A. The canonical invoices table ═════════════════════════════════════════

CREATE TABLE public.invoices (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_invoice_id   text         NOT NULL UNIQUE,
  account_id       uuid         NOT NULL REFERENCES public.accounts(id),
  billing_type     text         NOT NULL
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
  amount           numeric(8,2) NOT NULL,       -- authoritative invoice total
  period_label     text,                         -- contract only (else NULL)
  period_start     date,                         -- contract only
  period_end       date,                         -- contract only
  -- Real QBO lifecycle, synced back via getInvoice (never a visits.status value):
  --   draft   = created in QBO, not yet sent to the customer
  --   sent    = QBO emailed it (EmailStatus = EmailSent), balance still owed
  --   paid    = balance reached 0
  --   overdue = sent, still owed, past its due date
  status           text         NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  qbo_balance      numeric(8,2),                 -- QBO Balance snapshot
  qbo_due_date     date,                         -- QBO DueDate snapshot
  qbo_email_status text,                         -- raw QBO EmailStatus, debugging only
  sent_at          timestamptz,                  -- set once, first time status → sent/overdue
  paid_at          timestamptz,                  -- set once, first time status → paid
  last_synced_at   timestamptz,                  -- null = never synced; drives sync ordering
  created_at       timestamptz  NOT NULL DEFAULT now(),  -- == the "invoiced/pushed" moment
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY invoices_select
  ON public.invoices
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'accountant'));

CREATE POLICY invoices_insert
  ON public.invoices
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

-- Unlike the old contract_invoices (insert-only), invoices rows get UPDATEd
-- after insert by the status-sync path. The cron sync uses the service client
-- (bypasses RLS); this policy is for the manual "Refresh now" Server Action,
-- which runs under the accountant/owner's normal RLS client. These are
-- QBO-derived status fields only, not money-moving.
CREATE POLICY invoices_update
  ON public.invoices
  FOR UPDATE
  USING (get_my_role() IN ('owner', 'lead', 'accountant'))
  WITH CHECK (get_my_role() IN ('owner', 'lead', 'accountant'));

-- ═══ B. Backfill ═════════════════════════════════════════════════════════════

-- 1. Every existing contract invoice (the authoritative contract record).
INSERT INTO public.invoices
  (qbo_invoice_id, account_id, billing_type, amount, period_label,
   period_start, period_end, status, created_at)
SELECT
  ci.qbo_invoice_id, ci.account_id, 'contract', ci.amount, ci.period_label,
  ci.period_start, ci.period_end, 'draft', ci.invoiced_at
FROM public.contract_invoices ci;

-- 2. Every distinct qbo_invoice_id still living only on visits — ordinary
--    per_visit invoices AND legacy pre-ad-hoc contract pushes. The NOT IN guard
--    skips ids already inserted in step 1: createContractInvoice tags a
--    contract period's visits with the same qbo_invoice_id as its
--    contract_invoices row, so those would otherwise collide on the UNIQUE
--    constraint. amount = SUM(invoice_amount) (the legacy contract convention
--    put the full rate on one visit + 0 on the rest, so the sum is still right).
INSERT INTO public.invoices
  (qbo_invoice_id, account_id, billing_type, amount, status, created_at)
SELECT
  v.qbo_invoice_id,
  MIN(v.account_id::text)::uuid,   -- one invoice ⇒ one account; MIN is just an aggregate pick
  MIN(a.billing_type),
  SUM(COALESCE(v.invoice_amount, 0)),
  'draft',
  MIN(v.invoiced_at)
FROM public.visits v
JOIN public.accounts a ON a.id = v.account_id
WHERE v.qbo_invoice_id IS NOT NULL
  AND v.qbo_invoice_id NOT IN (SELECT qbo_invoice_id FROM public.invoices)
GROUP BY v.qbo_invoice_id;

-- 3. Point visits at their invoice row.
ALTER TABLE public.visits ADD COLUMN invoice_id uuid REFERENCES public.invoices(id);

UPDATE public.visits v
SET invoice_id = i.id
FROM public.invoices i
WHERE v.qbo_invoice_id = i.qbo_invoice_id;

-- ═══ C. Safety check + cutover ═══════════════════════════════════════════════

-- Fail loudly (rolling back the whole migration) rather than silently drop data
-- if any invoiced visit didn't map to an invoices row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.visits
    WHERE qbo_invoice_id IS NOT NULL AND invoice_id IS NULL
  ) THEN
    RAISE EXCEPTION 'invoices backfill incomplete: some visits.qbo_invoice_id did not map to an invoices row';
  END IF;
END $$;

-- contract_invoices is now folded into invoices (period_* columns).
DROP TABLE public.contract_invoices;

-- Collapse the two redundant billing columns into the invoice_id FK.
-- Dropping invoiced_at auto-cascades the old visits_uninvoiced_idx.
ALTER TABLE public.visits
  DROP COLUMN invoiced_at,
  DROP COLUMN qbo_invoice_id;

-- Re-create the "completed but not yet invoiced" partial index against the new
-- FK (this is exactly the query the billing Queue runs — see getUninvoicedVisits).
CREATE INDEX visits_uninvoiced_idx ON public.visits (id)
  WHERE status = 'completed' AND invoice_id IS NULL;
