-- Let crew caption the photos they took.
--
-- Photos are a primary communication channel for this crew — a photo without
-- "gate latch sticks, lift it" is doing half its job — but `photos_update` was
-- owner/lead only, so a crew member could upload a photo and never annotate it.
--
-- Two pieces, because RLS alone can't express "may edit this column but not
-- that one":
--   1. A policy scoping crew updates to their OWN photos (policies are OR'd, so
--      the existing owner/lead policy is untouched and still covers everything).
--   2. A trigger restricting crew to changing `caption` only. Correcting a
--      photo's `type` stays a privileged action, per the original intent
--      recorded on photos_update ("only owner/lead can edit captions or correct
--      photo type"), and this also stops a photo being re-pointed at another
--      property or visit.

CREATE POLICY photos_update_own_caption
  ON public.photos
  FOR UPDATE
  USING     (get_my_role() = 'crew' AND uploaded_by = get_my_employee_id())
  WITH CHECK (get_my_role() = 'crew' AND uploaded_by = get_my_employee_id());

CREATE OR REPLACE FUNCTION public.photos_crew_caption_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_my_role() = 'crew' THEN
    IF NEW.property_id  IS DISTINCT FROM OLD.property_id
    OR NEW.visit_id     IS DISTINCT FROM OLD.visit_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
    OR NEW.type         IS DISTINCT FROM OLD.type
    OR NEW.uploaded_by  IS DISTINCT FROM OLD.uploaded_by
    OR NEW.id           IS DISTINCT FROM OLD.id
    THEN
      RAISE EXCEPTION 'Crew can only edit a photo caption';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER photos_crew_caption_only_trigger
  BEFORE UPDATE ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION public.photos_crew_caption_only();
