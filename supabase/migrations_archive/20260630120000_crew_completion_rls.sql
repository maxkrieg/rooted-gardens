-- ─────────────────────────────────────────────────────────────────────────────
-- Allow crew to manage completed visit_crew rows for all employees
--
-- Previously crew could only INSERT a `completed` row for themselves
-- (employee_id = get_my_employee_id()), and could never DELETE a `completed`
-- row at all. This blocked the completion form from crediting the full crew
-- who was on site.
--
-- The completion form is peer-witnessed: the crew member logging the stop
-- vouches for everyone present. We allow any crew member to insert and delete
-- `completed` rows without restriction beyond being an authenticated crew role.
-- The `assigned` INSERT/DELETE rules are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS visit_crew_insert ON public.visit_crew;
CREATE POLICY visit_crew_insert
  ON public.visit_crew
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (get_my_role() = 'crew' AND relation = 'assigned')
    OR (get_my_role() = 'crew' AND relation = 'completed')
  );

DROP POLICY IF EXISTS visit_crew_delete ON public.visit_crew;
CREATE POLICY visit_crew_delete
  ON public.visit_crew
  FOR DELETE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR get_my_role() = 'crew'
  );
