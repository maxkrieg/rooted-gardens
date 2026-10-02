-- Super-admin impersonation (/admin/impersonate).
--
-- The developer, listed in the SUPER_ADMIN_USER_IDS env var, can sign in as any employee to
-- debug. The impersonated session is a real Supabase session for that person, so RLS and
-- the audit trigger treat every write as theirs. This migration records which auth sessions
-- are impersonated, so the Activity log can still say who was really behind them.

-- One row per impersonated auth session. Written only by the service client in
-- app/admin/impersonate/actions.ts: RLS on, no policies.
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The `session_id` claim of the impersonated access token. Stable across token refreshes,
  -- so a queued offline write that syncs later in the same session is still matched.
  auth_session_id uuid NOT NULL UNIQUE,
  -- auth.users id, not an employee: the super admin need not have an employee row.
  admin_user_id uuid NOT NULL,
  admin_label text NOT NULL,
  target_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_impersonation_sessions_updated_at
  BEFORE UPDATE ON public.impersonation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.impersonation_sessions FROM anon, authenticated;
GRANT ALL ON TABLE public.impersonation_sessions TO service_role;

-- Who was really signed in, when an impersonated session made the change. Null otherwise.
ALTER TABLE public.audit_log ADD COLUMN impersonated_by text;

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row jsonb;
  v_ignore text[] := ARRAY['created_at', 'updated_at'];
  v_changes jsonb;
  v_changed text[];
  v_action text;
  v_entity_id uuid;
  v_label text;
  v_actor_id uuid;
  v_actor_label text;
  v_impersonated_by text;
BEGIN
  v_row := coalesce(v_new, v_old);

  -- Public website form submissions are not staff actions.
  IF coalesce(auth.jwt() ->> 'role', '') = 'anon' THEN
    RETURN NULL;
  END IF;

  -- Completed-by rows are deleted and reinserted on every completion log;
  -- visit.completed already records the event.
  IF TG_TABLE_NAME = 'visit_crew' AND v_row ->> 'relation' = 'completed' THEN
    RETURN NULL;
  END IF;

  -- Columns whose changes alone aren't user actions (token refresh, QBO sync
  -- bookkeeping, a side effect of logging maintenance).
  v_ignore := v_ignore || CASE TG_TABLE_NAME
    WHEN 'integrations' THEN ARRAY['access_token', 'refresh_token', 'token_expires_at']
    WHEN 'invoices' THEN ARRAY['qbo_balance', 'qbo_due_date', 'qbo_email_status',
                               'sent_at', 'paid_at', 'last_synced_at']
    WHEN 'equipment' THEN ARRAY['last_serviced']
    WHEN 'site_content' THEN ARRAY['updated_by']
    ELSE ARRAY[]::text[]
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_array(v_old -> n.key, n.value)),
           array_agg(n.key)
      INTO v_changes, v_changed
      FROM jsonb_each(v_new) n
     WHERE NOT (n.key = ANY (v_ignore))
       AND n.value IS DISTINCT FROM v_old -> n.key;
    IF v_changed IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;
  v_changed := coalesce(v_changed, ARRAY[]::text[]);

  v_entity_id := (v_row ->> 'id')::uuid;

  CASE TG_TABLE_NAME
    WHEN 'visits' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'visit.created'
        WHEN TG_OP = 'DELETE' THEN 'visit.deleted'
        WHEN 'status' = ANY (v_changed) AND v_new ->> 'status' = 'completed' THEN 'visit.completed'
        WHEN 'status' = ANY (v_changed) AND v_new ->> 'status' = 'skipped' THEN 'visit.skipped'
        WHEN 'status' = ANY (v_changed) AND v_new ->> 'status' = 'scheduled' THEN 'visit.reverted'
        WHEN 'invoice_id' = ANY (v_changed) AND v_new ->> 'invoice_id' IS NOT NULL THEN 'visit.invoiced'
        WHEN 'started_at' = ANY (v_changed) AND v_old ->> 'started_at' IS NULL THEN 'visit.started'
        WHEN 'started_at' = ANY (v_changed) AND v_new ->> 'started_at' IS NULL THEN 'visit.start_discarded'
        WHEN 'ended_at' = ANY (v_changed) AND v_old ->> 'ended_at' IS NULL
             AND NOT ('started_at' = ANY (v_changed)) THEN 'visit.stopped'
        WHEN 'started_at' = ANY (v_changed) OR 'ended_at' = ANY (v_changed) THEN 'visit.times_edited'
        WHEN 'crew_instruction' = ANY (v_changed) THEN 'visit.instruction_changed'
        WHEN 'vehicle_id' = ANY (v_changed) THEN 'visit.vehicle_changed'
        ELSE 'visit.updated'
      END;
      SELECT p.address || ' · ' || a.name || ' · wk ' || to_char((v_row ->> 'week_start')::date, 'Mon FMDD')
        INTO v_label
        FROM properties p JOIN accounts a ON a.id = p.account_id
       WHERE p.id = (v_row ->> 'property_id')::uuid;

    WHEN 'visit_crew' THEN
      v_action := CASE WHEN TG_OP = 'DELETE' THEN 'crew.unassigned' ELSE 'crew.assigned' END;
      v_entity_id := (v_row ->> 'visit_id')::uuid;
      SELECT e.name || ' → ' || p.address || ' · wk ' || to_char(v.week_start, 'Mon FMDD')
        INTO v_label
        FROM visits v
        JOIN properties p ON p.id = v.property_id
        JOIN employees e ON e.id = (v_row ->> 'employee_id')::uuid
       WHERE v.id = v_entity_id;

    WHEN 'accounts' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'account.created'
        WHEN TG_OP = 'DELETE' THEN 'account.deleted'
        WHEN 'is_archived' = ANY (v_changed) AND (v_new ->> 'is_archived')::boolean THEN 'account.archived'
        WHEN v_changed = ARRAY['qbo_customer_id'] THEN 'account.qbo_linked'
        ELSE 'account.updated'
      END;
      v_label := v_row ->> 'name';

    WHEN 'properties' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'property.created'
        WHEN TG_OP = 'DELETE' THEN 'property.deleted'
        WHEN 'is_archived' = ANY (v_changed) AND (v_new ->> 'is_archived')::boolean THEN 'property.archived'
        WHEN v_changed <@ ARRAY['crew_notes', 'access_notes', 'parking_notes', 'preferred_interval_days']
          THEN 'property.notes_updated'
        ELSE 'property.updated'
      END;
      SELECT (v_row ->> 'address') || ' · ' || a.name INTO v_label
        FROM accounts a WHERE a.id = (v_row ->> 'account_id')::uuid;

    WHEN 'property_route_groups' THEN
      v_action := CASE
        WHEN TG_OP = 'DELETE' THEN 'property.route_removed'
        WHEN TG_OP = 'INSERT' OR 'route_group_id' = ANY (v_changed) THEN 'property.route_assigned'
        ELSE 'route.stops_reordered'
      END;
      v_entity_id := (v_row ->> 'property_id')::uuid;
      SELECT p.address || ' → ' || coalesce(rg.name, 'deleted route') INTO v_label
        FROM properties p
        LEFT JOIN route_groups rg ON rg.id = (v_row ->> 'route_group_id')::uuid
       WHERE p.id = v_entity_id;

    WHEN 'route_groups' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'route.created'
        WHEN TG_OP = 'DELETE' THEN 'route.deleted'
        WHEN 'name' = ANY (v_changed) THEN 'route.renamed'
        WHEN v_changed = ARRAY['sort_order'] THEN 'route.reordered'
        WHEN v_changed <@ ARRAY['default_vehicle_id', 'default_days'] THEN 'route.defaults_changed'
        ELSE 'route.updated'
      END;
      v_label := v_row ->> 'name';

    WHEN 'route_group_default_crew' THEN
      v_action := CASE WHEN TG_OP = 'DELETE' THEN 'route.default_crew_removed'
                       ELSE 'route.default_crew_added' END;
      v_entity_id := (v_row ->> 'route_group_id')::uuid;
      SELECT e.name || ' → ' || coalesce(rg.name, 'deleted route') INTO v_label
        FROM employees e
        LEFT JOIN route_groups rg ON rg.id = v_entity_id
       WHERE e.id = (v_row ->> 'employee_id')::uuid;

    WHEN 'route_group_week_notes' THEN
      v_action := CASE WHEN TG_OP = 'DELETE' THEN 'route.week_note_cleared'
                       ELSE 'route.week_note_set' END;
      v_entity_id := (v_row ->> 'route_group_id')::uuid;
      SELECT coalesce(rg.name, 'deleted route') || ' · wk '
             || to_char((v_row ->> 'week_start')::date, 'Mon FMDD')
        INTO v_label
        FROM (SELECT 1) one
        LEFT JOIN route_groups rg ON rg.id = v_entity_id;

    WHEN 'photos' THEN
      v_action := CASE TG_OP WHEN 'INSERT' THEN 'photo.added'
                             WHEN 'DELETE' THEN 'photo.deleted'
                             ELSE 'photo.updated' END;
      SELECT p.address || ' · ' || replace(v_row ->> 'type', '_', ' ') || ' photo' INTO v_label
        FROM properties p WHERE p.id = (v_row ->> 'property_id')::uuid;

    WHEN 'invoices' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'invoice.created'
        WHEN TG_OP = 'DELETE' THEN 'invoice.deleted'
        WHEN v_changed = ARRAY['status'] THEN 'invoice.status_synced'
        ELSE 'invoice.updated'
      END;
      SELECT a.name || ' · $' || (v_row ->> 'amount') INTO v_label
        FROM accounts a WHERE a.id = (v_row ->> 'account_id')::uuid;

    WHEN 'integrations' THEN
      v_action := CASE WHEN TG_OP = 'DELETE' THEN 'quickbooks.disconnected'
                       ELSE 'quickbooks.connected' END;
      v_label := 'QuickBooks';

    WHEN 'employees' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'employee.created'
        WHEN TG_OP = 'DELETE' THEN 'employee.deleted'
        WHEN 'user_id' = ANY (v_changed) THEN 'employee.invited'
        WHEN v_changed = ARRAY['sms_opt_out'] THEN 'employee.sms_pref_changed'
        ELSE 'employee.updated'
      END;
      v_label := v_row ->> 'name';

    WHEN 'vehicles' THEN
      v_action := CASE TG_OP WHEN 'INSERT' THEN 'vehicle.created'
                             WHEN 'DELETE' THEN 'vehicle.deleted'
                             ELSE 'vehicle.updated' END;
      v_label := v_row ->> 'name';

    WHEN 'equipment' THEN
      v_action := CASE TG_OP WHEN 'INSERT' THEN 'equipment.created'
                             WHEN 'DELETE' THEN 'equipment.deleted'
                             ELSE 'equipment.updated' END;
      v_label := v_row ->> 'name';

    WHEN 'maintenance_logs' THEN
      v_action := CASE TG_OP WHEN 'INSERT' THEN 'maintenance.logged'
                             WHEN 'DELETE' THEN 'maintenance.deleted'
                             ELSE 'maintenance.updated' END;
      SELECT coalesce(
               (SELECT name FROM vehicles WHERE id = (v_row ->> 'vehicle_id')::uuid),
               (SELECT name FROM equipment WHERE id = (v_row ->> 'equipment_id')::uuid)
             ) || ' · ' || (v_row ->> 'description')
        INTO v_label;

    WHEN 'leads' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'lead.created'
        WHEN TG_OP = 'DELETE' THEN 'lead.deleted'
        WHEN 'converted_account_id' = ANY (v_changed)
             AND v_new ->> 'converted_account_id' IS NOT NULL THEN 'lead.converted'
        WHEN 'status' = ANY (v_changed) THEN 'lead.status_changed'
        ELSE 'lead.updated'
      END;
      v_label := v_row ->> 'name';

    WHEN 'site_content' THEN
      v_action := 'site.content_edited';
      v_label := (v_row ->> 'page') || ' · ' || replace(v_row ->> 'key', '_', ' ');

    WHEN 'site_collection_items' THEN
      v_action := CASE
        WHEN TG_OP = 'INSERT' THEN 'site.item_added'
        WHEN TG_OP = 'DELETE' THEN 'site.item_deleted'
        WHEN v_changed = ARRAY['sort_order'] THEN 'site.item_reordered'
        ELSE 'site.item_updated'
      END;
      v_label := (v_row ->> 'collection') || ' · ' || coalesce(
        v_row -> 'data' ->> 'question', v_row -> 'data' ->> 'title', v_row -> 'data' ->> 'name', '');

    ELSE
      v_action := TG_TABLE_NAME || '.' || lower(TG_OP);
  END CASE;

  IF auth.uid() IS NOT NULL THEN
    SELECT id, name INTO v_actor_id, v_actor_label
      FROM employees WHERE user_id = auth.uid() LIMIT 1;
    -- A super admin signed in as this person: the write is theirs in every other
    -- respect, but the log keeps who was really at the keyboard.
    SELECT admin_label INTO v_impersonated_by
      FROM impersonation_sessions
     WHERE auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
  END IF;

  INSERT INTO audit_log
    (actor_employee_id, actor_label, action, entity_table, entity_id, entity_label, changes,
     impersonated_by)
  VALUES (
    v_actor_id,
    coalesce(v_actor_label, CASE WHEN auth.uid() IS NULL THEN 'System' ELSE 'Unknown user' END),
    v_action, TG_TABLE_NAME, v_entity_id, v_label, v_changes, v_impersonated_by
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the user's write because the log couldn't be written.
  RAISE WARNING 'audit_row_change(%.%): %', TG_TABLE_NAME, TG_OP, SQLERRM;
  RETURN NULL;
END;
$$;
