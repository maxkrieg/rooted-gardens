-- Fix visit_sessions INSERT policy: owner/lead were blocked from inserting
-- source='crew_app' sessions. Since owners can use the crew UI directly,
-- they need the same insert rights as crew (no source restriction).
DROP POLICY IF EXISTS visit_sessions_insert ON public.visit_sessions;
CREATE POLICY visit_sessions_insert
  ON public.visit_sessions
  FOR INSERT
  WITH CHECK (
    (
      get_my_role() = 'crew'
      AND source IN ('crew_app', 'manual')
      AND employee_id = get_my_employee_id()
    )
    OR get_my_role() IN ('owner', 'lead')
  );
