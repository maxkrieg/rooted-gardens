-- Route group defaults — crew, vehicle, and days of the week.
--
-- The crew's real route sheet names its groups "Wilder - Mon/Tues" and
-- "New Hampshire - Tues/Wed/thurs". There is no crew column and no day column
-- anywhere on that tab: the dispatch plan has always been encoded in the group
-- *name*, as a string, because the app gave it nowhere else to live. These
-- columns are that string, made queryable — and they are what lets a generated
-- week (R3.5) arrive with crew and truck already filled in.
--
-- Defaults, not assignments: a visit's own crew and vehicle always win. These
-- only supply a value where the visit has none.

ALTER TABLE public.route_groups
  ADD COLUMN default_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN default_days text[] NOT NULL DEFAULT '{}';

-- ON DELETE SET NULL, not CASCADE: retiring a truck must not delete the route.

-- `<@` is "contained by", so this rejects any element outside the week without
-- constraining the array's length or order. Order is meaningful to read back
-- ("Mon/Tues"), so this is a list rather than a set of seven booleans.
ALTER TABLE public.route_groups
  ADD CONSTRAINT route_groups_default_days_valid
  CHECK (default_days <@ ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]);

-- Postgres does not index FK columns automatically, and the fleet page asks
-- "what uses this vehicle" when a truck goes into maintenance.
CREATE INDEX IF NOT EXISTS route_groups_default_vehicle_idx
  ON public.route_groups (default_vehicle_id)
  WHERE default_vehicle_id IS NOT NULL;

-- ─── Default crew ───────────────────────────────────────────────────────────────
-- A join table, not a uuid[] on route_groups. Same reasoning as visit_crew
-- (see CLAUDE.md): Realtime's postgres_changes filters can't express array
-- containment, arrays can't be FK-joined, and they can't be used cleanly in RLS.
-- A route group has a handful of regulars, so this stays tiny.
CREATE TABLE public.route_group_default_crew (
  route_group_id uuid NOT NULL REFERENCES public.route_groups(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_group_id, employee_id)
);

-- The PK's leading column already serves route_group_id lookups. This covers the
-- other direction — "which routes is this person a regular on" — and the cascade
-- when an employee row is deleted.
CREATE INDEX IF NOT EXISTS route_group_default_crew_employee_idx
  ON public.route_group_default_crew (employee_id);

ALTER TABLE public.route_group_default_crew ENABLE ROW LEVEL SECURITY;

-- Everyone reads it: crew need to see who a route's regulars are, the same way
-- they can already read route_groups and property_route_groups. Only owner and
-- lead change it, matching route_groups' own write policies.
CREATE POLICY "route_group_default_crew_select" ON public.route_group_default_crew
  FOR SELECT USING (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text, 'crew'::text, 'accountant'::text])
  );

CREATE POLICY "route_group_default_crew_insert" ON public.route_group_default_crew
  FOR INSERT WITH CHECK (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  );

CREATE POLICY "route_group_default_crew_delete" ON public.route_group_default_crew
  FOR DELETE USING (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  );

-- No UPDATE policy: both columns are the primary key, so a change is a
-- delete plus an insert. An UPDATE policy here would be dead weight.

GRANT ALL ON TABLE public.route_group_default_crew TO anon;
GRANT ALL ON TABLE public.route_group_default_crew TO authenticated;
GRANT ALL ON TABLE public.route_group_default_crew TO service_role;
