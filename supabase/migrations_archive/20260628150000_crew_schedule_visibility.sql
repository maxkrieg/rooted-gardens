-- ─────────────────────────────────────────────────────────────────────────────
-- Crew self-service scheduling: widen crew visibility + crew reassignment
--
-- Until now crew could only SEE visits / visit_crew rows they were personally
-- linked to, and only owner/lead could move crew between visits. Owners want crew
-- to self-organize coverage in the field: any crew member can now view the whole
-- week's schedule (all route groups, all visits, all assigned crew + the roster)
-- and add/remove `assigned` crew on any visit.
--
-- Still locked down for crew: `completed` visit_crew rows (completion audit trail)
-- remain self-only on insert and undeletable; all other tables are unchanged.
--
-- Reuses get_my_role() / get_my_employee_id() from earlier RLS migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── visits: crew can read ALL visits (was: only their assigned ones) ──────────
-- visits_update is intentionally left unchanged — it still gates crew to visits
-- they are linked to (a crew member assigns themselves first, then can update).
DROP POLICY IF EXISTS visits_select ON public.visits;
CREATE POLICY visits_select
  ON public.visits
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'accountant', 'crew'));

-- ─── visit_crew: crew can read ALL rows (to show assigned crew per visit) ──────
DROP POLICY IF EXISTS visit_crew_select ON public.visit_crew;
CREATE POLICY visit_crew_select
  ON public.visit_crew
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'accountant', 'crew'));

-- crew can now insert `assigned` rows for any employee (reassignment), while
-- `completed` rows stay self-only (protects the completion audit trail)
DROP POLICY IF EXISTS visit_crew_insert ON public.visit_crew;
CREATE POLICY visit_crew_insert
  ON public.visit_crew
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (get_my_role() = 'crew' AND relation = 'assigned')
    OR (
      get_my_role() = 'crew'
      AND relation = 'completed'
      AND employee_id = get_my_employee_id()
    )
  );

-- crew can delete `assigned` rows only (never `completed`)
DROP POLICY IF EXISTS visit_crew_delete ON public.visit_crew;
CREATE POLICY visit_crew_delete
  ON public.visit_crew
  FOR DELETE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (get_my_role() = 'crew' AND relation = 'assigned')
  );

-- ─── employees: crew can read the full roster (name picker + assigned names) ───
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select
  ON public.employees
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead', 'accountant', 'crew')
    OR user_id = auth.uid()
  );
