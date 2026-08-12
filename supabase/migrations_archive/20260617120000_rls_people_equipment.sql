-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies for employees and vehicles
-- Reuses get_my_role() from 20260615020240_rls_core_crm.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── employees ────────────────────────────────────────────────────────────────
-- owner/lead/accountant see all employees (scheduling, payroll, team management)
-- crew see only their own row

CREATE POLICY employees_select
  ON public.employees
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant')
    OR user_id = auth.uid()
  );

CREATE POLICY employees_insert
  ON public.employees
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY employees_update
  ON public.employees
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));

-- ─── vehicles ─────────────────────────────────────────────────────────────────
-- owner/lead manage the fleet; crew need vehicle info on their assigned visits

CREATE POLICY vehicles_select
  ON public.vehicles
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew'));

CREATE POLICY vehicles_insert
  ON public.vehicles
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY vehicles_update
  ON public.vehicles
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));
