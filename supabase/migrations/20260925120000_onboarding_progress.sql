-- Per-person onboarding progress: welcome, guided tours, checklist tasks, and
-- "What's new" announcements. Keys and versions come from the code registry
-- (lib/onboarding/registry.ts); a row only records what this person has done.
--
-- A table, not employees columns: employees is owner-only for UPDATE, and this
-- has to be writable by every role through the offline queue.
CREATE TABLE public.onboarding_progress (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  state text NOT NULL CHECK (state IN ('seen', 'completed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, item_key)
);

CREATE TRIGGER set_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Your own rows; owners read everyone's for the Team page.
CREATE POLICY "onboarding_progress_select" ON public.onboarding_progress
  FOR SELECT USING (
    employee_id = public.get_my_employee_id() OR public.get_my_role() = 'owner'
  );

CREATE POLICY "onboarding_progress_insert" ON public.onboarding_progress
  FOR INSERT WITH CHECK (employee_id = public.get_my_employee_id());

CREATE POLICY "onboarding_progress_update" ON public.onboarding_progress
  FOR UPDATE USING (employee_id = public.get_my_employee_id())
  WITH CHECK (employee_id = public.get_my_employee_id());

-- No DELETE policy: progress is only ever upserted.

GRANT ALL ON TABLE public.onboarding_progress TO authenticated;
GRANT ALL ON TABLE public.onboarding_progress TO service_role;
