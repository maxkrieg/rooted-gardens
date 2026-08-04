-- =================================================================
-- Task 9.1 — leads table (public marketing site + lead intake)
-- =================================================================
-- Captures UNTRUSTED public form input from the marketing site (inquiry +
-- job application forms, Phase 9), kept separate from `accounts` (the
-- curated set of billing entities). Owners triage in the management Leads
-- inbox (9.8) and convert a qualified service_inquiry into a `prospective`
-- account (9.9).
--
-- This is the first anon-writable table in the app. Every other table is
-- staff-only, and the initial schema deliberately grants `anon` nothing
-- ("anon gets no table grants — no public content in this private app").
-- That posture changes here: anon gets INSERT only, never SELECT, and the
-- INSERT is constrained so a public poster can only ever create a fresh,
-- untriaged lead — never one that already looks assigned/converted/won.
-- =================================================================

CREATE TABLE public.leads (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                 text        NOT NULL
    CHECK (kind IN ('service_inquiry', 'job_application')),
  status               text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  name                 text        NOT NULL
    CHECK (char_length(name) BETWEEN 1 AND 200),
  email                text
    CHECK (email   IS NULL OR char_length(email)   <= 320),
  phone                text
    CHECK (phone   IS NULL OR char_length(phone)   <= 40),
  -- Single text blob, like properties.address — not the structured
  -- billing_address_* columns on accounts (those exist to map onto QBO's
  -- BillAddr; see 20260707131627_accounts_add_billing_address.sql).
  address              text
    CHECK (address IS NULL OR char_length(address) <= 500),
  service_interest     text
    CHECK (service_interest IN ('lawn', 'garden', 'both', 'other')),
  message              text
    CHECK (message IS NULL OR char_length(message) <= 5000),
  source               text        NOT NULL DEFAULT 'website',
  details              jsonb,
  -- No ON DELETE CASCADE on either FK: deleting an employee or account
  -- should not silently destroy the lead history that produced it.
  assigned_to          uuid        REFERENCES public.employees(id),
  converted_account_id uuid        REFERENCES public.accounts(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- INDEXES
-- =================================================================

-- Backs the 9.8 inbox's default ordering and its kind/status filters.
CREATE INDEX leads_status_created_idx ON public.leads (status, created_at DESC);
CREATE INDEX leads_kind_created_idx   ON public.leads (kind, created_at DESC);
CREATE INDEX leads_assigned_to_idx    ON public.leads (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- =================================================================
-- GRANTS
-- =================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

-- The public marketing form (9.5) posts as `anon`. INSERT only —
-- deliberately no SELECT, so a website visitor can never read other
-- people's inquiries.
GRANT INSERT ON public.leads TO anon;

-- =================================================================
-- RLS POLICIES
-- =================================================================
-- owner/lead: full SELECT + UPDATE (triage the pipeline).
-- crew/accountant: no access at all (fail every get_my_role() check below).
-- DELETE: no policy for anyone — service-role only, matching every other
-- table in this schema.

CREATE POLICY leads_select
  ON public.leads
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead'));

CREATE POLICY leads_update
  ON public.leads
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));

-- Public form submissions. Constrained so a hostile poster can only create
-- a brand-new, unassigned, unconverted lead — never inject a row that
-- already looks triaged, nor link itself to an existing account.
CREATE POLICY leads_insert_anon
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'new'
    AND source = 'website'
    AND assigned_to IS NULL
    AND converted_account_id IS NULL
  );

-- Owners/leads may also record a lead by hand (e.g. a phone-in inquiry).
CREATE POLICY leads_insert_staff
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

-- =================================================================
-- REALTIME
-- =================================================================
-- The management Leads inbox (9.7) subscribes to INSERT for the new-lead
-- toast. Subscribers still go through RLS, so only owner/lead receive
-- events. (See 20260804120000_fix_realtime_publication.sql — confirmed via
-- `supabase db query --linked` that supabase_realtime is a curated
-- publication, not FOR ALL TABLES, so this ADD TABLE is required and safe.)
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
