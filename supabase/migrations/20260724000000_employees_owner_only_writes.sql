-- Tighten employees write policies to owner-only (task 7.1).
-- Team management (create/edit employees, invite, SMS consent) is owner-only.
-- The original policies (20260617120000_rls_people_equipment) allowed owner AND
-- lead to INSERT/UPDATE; no lead flow writes the employees table, so this is a
-- safe tightening. SELECT is left unchanged (owner/lead/accountant see all,
-- crew see their own + the roster widening from 20260628150000).

DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert
  ON public.employees
  FOR INSERT
  WITH CHECK (get_my_role() = 'owner');

DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update
  ON public.employees
  FOR UPDATE
  USING     (get_my_role() = 'owner')
  WITH CHECK(get_my_role() = 'owner');
