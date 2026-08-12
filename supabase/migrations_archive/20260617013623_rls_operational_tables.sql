-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2.8 — RLS policies for operational tables
-- Tables: visits, visit_crew, visit_sessions, time_entries, photos, integrations
-- Reuses get_my_role() from 20260615020240_rls_core_crm.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: returns the current user's employee id (mirrors get_my_role() pattern)
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM   public.employees
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

-- ─── visits ───────────────────────────────────────────────────────────────────

-- owner/lead/accountant see all; crew see only visits they are linked to
CREATE POLICY visits_select
  ON public.visits
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visits.id
          AND vc.employee_id = get_my_employee_id()
      )
    )
  );

-- only owner/lead can create visits
CREATE POLICY visits_insert
  ON public.visits
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

-- owner/lead full update; crew can update visits they are linked to (app layer
-- enforces which columns); accountant can update invoicing fields (app layer)
CREATE POLICY visits_update
  ON public.visits
  FOR UPDATE
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visits.id
          AND vc.employee_id = get_my_employee_id()
      )
    )
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visits.id
          AND vc.employee_id = get_my_employee_id()
      )
    )
  );

CREATE POLICY visits_delete
  ON public.visits
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));

-- ─── visit_crew ───────────────────────────────────────────────────────────────

-- owner/lead/accountant see all; crew see only their own rows
CREATE POLICY visit_crew_select
  ON public.visit_crew
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

-- owner/lead insert any row (assign); crew insert only their own completed rows
CREATE POLICY visit_crew_insert
  ON public.visit_crew
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND relation = 'completed'
      AND employee_id = get_my_employee_id()
    )
  );

-- owner/lead full; crew update their own rows only
CREATE POLICY visit_crew_update
  ON public.visit_crew
  FOR UPDATE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

CREATE POLICY visit_crew_delete
  ON public.visit_crew
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));

-- ─── visit_sessions ───────────────────────────────────────────────────────────

-- owner/lead see all; crew see only their own sessions
CREATE POLICY visit_sessions_select
  ON public.visit_sessions
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

-- crew insert their own crew_app sessions; owner/lead insert manual corrections
CREATE POLICY visit_sessions_insert
  ON public.visit_sessions
  FOR INSERT
  WITH CHECK (
    (
      get_my_role() = 'crew'
      AND source = 'crew_app'
      AND employee_id = get_my_employee_id()
    )
    OR (get_my_role() IN ('owner', 'lead') AND source = 'manual')
  );

-- crew update their own sessions (e.g. set ended_at); owner/lead update any
CREATE POLICY visit_sessions_update
  ON public.visit_sessions
  FOR UPDATE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

-- ─── time_entries ─────────────────────────────────────────────────────────────

-- owner/lead/accountant see all; crew see only their own
CREATE POLICY time_entries_select
  ON public.time_entries
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

-- owner/lead insert for any employee; crew insert their own
CREATE POLICY time_entries_insert
  ON public.time_entries
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
    )
  );

-- owner/lead can update any (including approving); crew can only update their own
-- unapproved entries (prevents tampering after approval)
CREATE POLICY time_entries_update
  ON public.time_entries
  FOR UPDATE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
      AND approved = false
    )
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND employee_id = get_my_employee_id()
      AND approved = false
    )
  );

-- ─── photos ───────────────────────────────────────────────────────────────────

-- all authenticated roles can view photos
CREATE POLICY photos_select
  ON public.photos
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

-- crew and owner/lead can upload photos
CREATE POLICY photos_insert
  ON public.photos
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead', 'crew'));

-- only owner/lead can edit captions or correct photo type
CREATE POLICY photos_update
  ON public.photos
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));

CREATE POLICY photos_delete
  ON public.photos
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));

-- ─── integrations ─────────────────────────────────────────────────────────────
-- OAuth tokens — owner only, never exposed to crew or accountant

CREATE POLICY integrations_select
  ON public.integrations
  FOR SELECT
  USING (get_my_role() = 'owner');

CREATE POLICY integrations_insert
  ON public.integrations
  FOR INSERT
  WITH CHECK (get_my_role() = 'owner');

CREATE POLICY integrations_update
  ON public.integrations
  FOR UPDATE
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');
