-- Fleet maintenance logging (Phase 6, task 6.3). One row per maintenance event
-- against a vehicle OR an equipment item — a shared timeline the owner logs from
-- the Fleet page. next_service_due drives the "Due soon" / "Overdue" badges on the
-- fleet cards and (later) the dashboard. Polymorphic parent via two nullable FKs
-- with a CHECK enforcing exactly one target, so a log always belongs to precisely
-- one thing and both sides get an index for its own timeline query.
CREATE TABLE public.maintenance_logs (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid         REFERENCES public.vehicles(id)  ON DELETE CASCADE,
  equipment_id     uuid         REFERENCES public.equipment(id) ON DELETE CASCADE,
  service_date     date         NOT NULL,
  description      text         NOT NULL,
  next_service_due date,
  cost             numeric(8,2),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_logs_one_target CHECK (
    (vehicle_id IS NOT NULL) <> (equipment_id IS NOT NULL)
  )
);

CREATE INDEX maintenance_logs_vehicle_idx
  ON public.maintenance_logs (vehicle_id, service_date DESC);
CREATE INDEX maintenance_logs_equipment_idx
  ON public.maintenance_logs (equipment_id, service_date DESC);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_maintenance_logs_updated_at
  BEFORE UPDATE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY maintenance_logs_select
  ON public.maintenance_logs
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew'));

CREATE POLICY maintenance_logs_insert
  ON public.maintenance_logs
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY maintenance_logs_update
  ON public.maintenance_logs
  FOR UPDATE
  USING (get_my_role() IN ('owner', 'lead'))
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY maintenance_logs_delete
  ON public.maintenance_logs
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));

-- Backfill the equipment RLS policies. equipment had RLS ENABLED in the initial
-- schema but no policies were ever added (the misnamed rls_people_equipment
-- migration only covered vehicles), so equipment returned zero rows for every
-- role. Mirror the vehicles policy shape: owner/lead/crew read, owner/lead write.
-- (No delete policy — retirement is the soft-delete via status = 'retired'.)
CREATE POLICY equipment_select
  ON public.equipment
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew'));

CREATE POLICY equipment_insert
  ON public.equipment
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY equipment_update
  ON public.equipment
  FOR UPDATE
  USING (get_my_role() IN ('owner', 'lead'))
  WITH CHECK (get_my_role() IN ('owner', 'lead'));
