-- The route sheet's group-header dispatch note.
--
-- On the real sheet these sit above a route's rows, one per group per week:
--   "matts gone all week … no Ryan till Thurs. & no Christian Monday or Tuesday"
--   "maybe Jack on vacation?"
--   "plz don't skip any borderline decisions this week"
--
-- The app had nowhere to put them. visits.crew_instruction is per visit — this is
-- read by the whole crew working a route, and it is about the *week*, not a stop.
-- Writing it into one visit's instruction would hide it from everyone working the
-- other stops.

CREATE TABLE public.route_group_week_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_group_id uuid NOT NULL REFERENCES public.route_groups(id) ON DELETE CASCADE,
  -- Always a Monday, matching visits.week_start and the whole app's week model.
  week_start date NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One note per group per week. This is also what makes the offline queue's
  -- write replay-safe: it upserts on this constraint rather than inserting.
  UNIQUE (route_group_id, week_start)
);

-- The schedule loads every note for the week on screen, across all groups. The
-- UNIQUE constraint's index is (route_group_id, week_start), whose leading column
-- is the wrong one for that query.
CREATE INDEX IF NOT EXISTS route_group_week_notes_week_idx
  ON public.route_group_week_notes (week_start);

CREATE OR REPLACE TRIGGER "set_route_group_week_notes_updated_at"
  BEFORE UPDATE ON public.route_group_week_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.route_group_week_notes ENABLE ROW LEVEL SECURITY;

-- Crew read it — that is the entire point of the note. Only owner and lead
-- write it, matching route_groups.
CREATE POLICY "route_group_week_notes_select" ON public.route_group_week_notes
  FOR SELECT USING (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text, 'crew'::text, 'accountant'::text])
  );

CREATE POLICY "route_group_week_notes_insert" ON public.route_group_week_notes
  FOR INSERT WITH CHECK (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  );

CREATE POLICY "route_group_week_notes_update" ON public.route_group_week_notes
  FOR UPDATE USING (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  ) WITH CHECK (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  );

CREATE POLICY "route_group_week_notes_delete" ON public.route_group_week_notes
  FOR DELETE USING (
    public.get_my_role() = ANY (ARRAY['owner'::text, 'lead'::text])
  );

GRANT ALL ON TABLE public.route_group_week_notes TO anon;
GRANT ALL ON TABLE public.route_group_week_notes TO authenticated;
GRANT ALL ON TABLE public.route_group_week_notes TO service_role;
