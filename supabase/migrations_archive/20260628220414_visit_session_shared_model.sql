-- ─────────────────────────────────────────────────────────────────────────────
-- Shared visit session model
--
-- Changes the visit_sessions model from per-employee concurrent sessions to a
-- single shared session per visit:
--   - One crew member starts → all assigned crew see the same "On site" state.
--   - Any assigned crew member can stop the session (not just the initiator).
--   - Crew can now create `source = 'manual'` sessions for retroactive start time.
--
-- Attendance tracking (who was there) stays on visit_crew.relation='completed',
-- written by the completion logger (task 4.4). Sessions are the visit timer only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enforce at most one open session per visit ───────────────────────────────
-- The previous design allowed concurrent per-employee sessions. The new model has
-- exactly one open session per visit at a time; the DB enforces this so the app
-- layer doesn't need to coordinate.
CREATE UNIQUE INDEX visit_sessions_one_open_per_visit
  ON public.visit_sessions (visit_id)
  WHERE ended_at IS NULL;


-- ─── visit_sessions SELECT: crew see sessions for their assigned visits ────────
-- Previously crew could only see their own sessions (employee_id = me).
-- Now any crew member assigned to a visit can see the shared session so the
-- "On site" indicator shows up for everyone on the team.
DROP POLICY IF EXISTS visit_sessions_select ON public.visit_sessions;
CREATE POLICY visit_sessions_select
  ON public.visit_sessions
  FOR SELECT
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visit_sessions.visit_id
          AND vc.employee_id = get_my_employee_id()
          AND vc.relation = 'assigned'
      )
    )
  );


-- ─── visit_sessions INSERT: crew may now use source = 'manual' ────────────────
-- Previously crew could only insert source = 'crew_app'. Retroactive start time
-- (when crew forgot to tap Start) uses source = 'manual' with a crew-chosen
-- started_at. The unique index above prevents a second open session.
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
    OR (
      get_my_role() IN ('owner', 'lead')
      AND source = 'manual'
    )
  );


-- ─── visit_sessions UPDATE: any assigned crew member can stop the session ──────
-- Previously only the session owner (employee_id = me) could update their row.
-- Now any crew member assigned to the visit can stop the shared session.
DROP POLICY IF EXISTS visit_sessions_update ON public.visit_sessions;
CREATE POLICY visit_sessions_update
  ON public.visit_sessions
  FOR UPDATE
  USING (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visit_sessions.visit_id
          AND vc.employee_id = get_my_employee_id()
          AND vc.relation = 'assigned'
      )
    )
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'lead')
    OR (
      get_my_role() = 'crew'
      AND EXISTS (
        SELECT 1 FROM public.visit_crew vc
        WHERE vc.visit_id = visit_sessions.visit_id
          AND vc.employee_id = get_my_employee_id()
          AND vc.relation = 'assigned'
      )
    )
  );
