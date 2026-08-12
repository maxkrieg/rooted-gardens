-- =================================================================
-- Drop leads.assigned_to — the "assign to an owner/lead" concept on the
-- Leads inbox (task 9.8) turned out not to be needed at this company's
-- volume; owners triage inline without a separate assignment step.
-- =================================================================

-- The anon INSERT policy (20260804130000_leads.sql) references assigned_to
-- in its WITH CHECK, so it has to be replaced before the column can drop.
DROP POLICY leads_insert_anon ON public.leads;

CREATE POLICY leads_insert_anon
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'new'
    AND source = 'website'
    AND converted_account_id IS NULL
  );

-- Drops the leads_assigned_to_idx partial index and the employees FK along
-- with the column — both depend solely on it.
ALTER TABLE public.leads DROP COLUMN assigned_to;
