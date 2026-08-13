-- =================================================================
-- BASELINE SCHEMA — squash of 32 migrations (20260613013930 through
-- 20260807090000), run for a fresh Supabase project (prod standup).
--
-- This file replaces the incremental migration history: several of the
-- originals only existed to undo earlier ones (drop_service_zones,
-- drop_time_entries, drop_invoiced_status, collapse_visit_sessions,
-- drop_leads_assigned_to, drop_visits_invoice_amount), and one
-- (20260714120000_invoices.sql) carried a one-time data backfill from the
-- old contract_invoices table that has no business running against an
-- empty database. Section 1 below is a schema-only dump of the live dev
-- project (obbbvohmcaneehzxuuyo) as of 2026-08-12 — i.e. the actual
-- current state, not a replay of every intermediate step. Sections 2-3
-- hand-carry what a plain schema dump can't see: Storage buckets/policies
-- and the live site_content / site_collection_items marketing copy.
--
-- The 32 original migration files are preserved (not deleted) at
-- supabase/migrations_archive/ — CLAUDE.md cites several of their
-- filenames as historical documentation (e.g. "migration
-- 20260630130000_drop_service_zones", "migration 20260714120000
-- collapsed the old invoiced_at + qbo_invoice_id columns"), and those
-- references stay resolvable there.
--
-- This version number (20260807090000) reuses the last-applied migration
-- timestamp so the existing dev project's history needs no update for
-- this file specifically. The other 31 versions were separately marked
-- 'reverted' via `supabase migration repair --linked --status reverted`
-- so `supabase migration list --linked` shows only this one row.
-- =================================================================

-- =================================================================
-- SECTION 1 — public schema (tables, functions, triggers, indexes,
-- constraints, RLS policies, realtime publication membership, grants).
-- Verbatim `supabase db dump --linked --schema-only` output for the
-- public schema, captured 2026-08-12.
-- =================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."enforce_accountant_account_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF get_my_role() = 'accountant' THEN
    IF (
      NEW.name            IS DISTINCT FROM OLD.name            OR
      NEW.contact_name    IS DISTINCT FROM OLD.contact_name    OR
      NEW.email           IS DISTINCT FROM OLD.email           OR
      NEW.phone           IS DISTINCT FROM OLD.phone           OR
      NEW.billing_type    IS DISTINCT FROM OLD.billing_type    OR
      NEW.price_per_visit IS DISTINCT FROM OLD.price_per_visit OR
      NEW.contract_rate   IS DISTINCT FROM OLD.contract_rate   OR
      NEW.contract_period IS DISTINCT FROM OLD.contract_period OR
      NEW.status          IS DISTINCT FROM OLD.status          OR
      NEW.notes           IS DISTINCT FROM OLD.notes
    ) THEN
      RAISE EXCEPTION
        'accountant role may only update accounts.qbo_customer_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_accountant_account_columns"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_employee_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id
  FROM   public.employees
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

ALTER FUNCTION "public"."get_my_employee_id"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM   public.employees
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."photos_crew_caption_only"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

ALTER FUNCTION "public"."photos_crew_caption_only"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "billing_type" "text" NOT NULL,
    "price_per_visit" numeric(8,2),
    "contract_rate" numeric(8,2),
    "contract_period" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "qbo_customer_id" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "billing_address_line1" "text",
    "billing_address_line2" "text",
    "billing_city" "text",
    "billing_state" "text",
    "billing_zip" "text",
    CONSTRAINT "accounts_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['per_visit'::"text", 'contract'::"text", 'as_needed'::"text"]))),
    CONSTRAINT "accounts_contract_period_check" CHECK (("contract_period" = ANY (ARRAY['monthly'::"text", 'seasonal'::"text"]))),
    CONSTRAINT "accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'prospective'::"text"])))
);

ALTER TABLE "public"."accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "phone" "text",
    "sms_opt_out" boolean DEFAULT false NOT NULL,
    "email" "text",
    "role" "text" NOT NULL,
    "side" "text",
    "active" boolean DEFAULT true NOT NULL,
    "hourly_rate" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employees_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'crew'::"text", 'accountant'::"text", 'lead'::"text"]))),
    CONSTRAINT "employees_side_check" CHECK (("side" = ANY (ARRAY['lawn'::"text", 'garden'::"text", 'both'::"text"])))
);

ALTER TABLE "public"."employees" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "last_serviced" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "equipment_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'in_use'::"text", 'maintenance'::"text", 'retired'::"text"]))),
    CONSTRAINT "equipment_type_check" CHECK (("type" = ANY (ARRAY['mower'::"text", 'trimmer'::"text", 'blower'::"text", 'edger'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."equipment" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service" "text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "realm_id" "text",
    "token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."integrations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "qbo_invoice_id" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "billing_type" "text" NOT NULL,
    "amount" numeric(8,2) NOT NULL,
    "period_label" "text",
    "period_start" "date",
    "period_end" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "qbo_balance" numeric(8,2),
    "qbo_due_date" "date",
    "qbo_email_status" "text",
    "sent_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['per_visit'::"text", 'contract'::"text", 'as_needed'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'paid'::"text", 'overdue'::"text"])))
);

ALTER TABLE "public"."invoices" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."lead_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_hash" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_submissions_kind_check" CHECK (("kind" = ANY (ARRAY['service_inquiry'::"text", 'job_application'::"text"])))
);

ALTER TABLE "public"."lead_submissions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "service_interest" "text",
    "message" "text",
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "details" "jsonb",
    "converted_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leads_address_check" CHECK ((("address" IS NULL) OR ("char_length"("address") <= 500))),
    CONSTRAINT "leads_email_check" CHECK ((("email" IS NULL) OR ("char_length"("email") <= 320))),
    CONSTRAINT "leads_kind_check" CHECK (("kind" = ANY (ARRAY['service_inquiry'::"text", 'job_application'::"text"]))),
    CONSTRAINT "leads_message_check" CHECK ((("message" IS NULL) OR ("char_length"("message") <= 5000))),
    CONSTRAINT "leads_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 200))),
    CONSTRAINT "leads_phone_check" CHECK ((("phone" IS NULL) OR ("char_length"("phone") <= 40))),
    CONSTRAINT "leads_service_interest_check" CHECK (("service_interest" = ANY (ARRAY['lawn'::"text", 'garden'::"text", 'both'::"text", 'other'::"text"]))),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'qualified'::"text", 'won'::"text", 'lost'::"text"])))
);

ALTER TABLE "public"."leads" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."maintenance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid",
    "equipment_id" "uuid",
    "service_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "next_service_due" "date",
    "cost" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "maintenance_logs_one_target" CHECK ((("vehicle_id" IS NOT NULL) <> ("equipment_id" IS NOT NULL)))
);

ALTER TABLE "public"."maintenance_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "visit_id" "uuid",
    "storage_path" "text" NOT NULL,
    "type" "text" DEFAULT 'visit'::"text" NOT NULL,
    "caption" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photos_type_check" CHECK (("type" = ANY (ARRAY['visit'::"text", 'how_to'::"text", 'customer_request'::"text", 'before'::"text", 'after'::"text", 'plan'::"text"])))
);

ALTER TABLE "public"."photos" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "address" "text" NOT NULL,
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "parking_notes" "text",
    "access_notes" "text",
    "crew_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "frequency" "text" DEFAULT 'weekly'::"text" NOT NULL,
    CONSTRAINT "properties_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'as_needed'::"text"])))
);

ALTER TABLE "public"."properties" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."property_route_groups" (
    "property_id" "uuid" NOT NULL,
    "route_group_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."property_route_groups" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."route_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."route_groups" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."site_collection_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_collection_items_collection_check" CHECK (("collection" = ANY (ARRAY['faq'::"text", 'job'::"text", 'team'::"text"])))
);

ALTER TABLE "public"."site_collection_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page" "text" NOT NULL,
    "key" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "value" "jsonb",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_content_key_check" CHECK ((("char_length"("key") >= 1) AND ("char_length"("key") <= 100))),
    CONSTRAINT "site_content_kind_check" CHECK (("kind" = ANY (ARRAY['text'::"text", 'richtext'::"text", 'image'::"text", 'email'::"text", 'phone'::"text", 'url'::"text"]))),
    CONSTRAINT "site_content_page_check" CHECK (("page" = ANY (ARRAY['global'::"text", 'home'::"text", 'lawn'::"text", 'gardens'::"text", 'about'::"text", 'faq'::"text", 'jobs'::"text", 'contact'::"text"])))
);

ALTER TABLE "public"."site_content" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'truck'::"text" NOT NULL,
    "plate" "text",
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicles_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'in_use'::"text", 'maintenance'::"text", 'retired'::"text"])))
);

ALTER TABLE "public"."vehicles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."visit_crew" (
    "visit_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "relation" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "visit_crew_relation_check" CHECK (("relation" = ANY (ARRAY['assigned'::"text", 'completed'::"text"])))
);

ALTER TABLE "public"."visit_crew" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "crew_instruction" "text",
    "vehicle_id" "uuid",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "service_types" "text"[],
    "completion_note" "text",
    "skip_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "invoice_id" "uuid",
    CONSTRAINT "visits_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'skipped'::"text"])))
);

ALTER TABLE "public"."visits" OWNER TO "postgres";

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_qbo_invoice_id_key" UNIQUE ("qbo_invoice_id");

ALTER TABLE ONLY "public"."lead_submissions"
    ADD CONSTRAINT "lead_submissions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_route_groups"
    ADD CONSTRAINT "property_route_groups_pkey" PRIMARY KEY ("property_id", "route_group_id");

ALTER TABLE ONLY "public"."route_groups"
    ADD CONSTRAINT "route_groups_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."site_collection_items"
    ADD CONSTRAINT "site_collection_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_page_key_key" UNIQUE ("page", "key");

ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."visit_crew"
    ADD CONSTRAINT "visit_crew_pkey" PRIMARY KEY ("visit_id", "employee_id", "relation");

ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");

CREATE INDEX "lead_submissions_created_idx" ON "public"."lead_submissions" USING "btree" ("created_at");

CREATE INDEX "lead_submissions_ip_created_idx" ON "public"."lead_submissions" USING "btree" ("ip_hash", "created_at" DESC);

CREATE INDEX "leads_kind_created_idx" ON "public"."leads" USING "btree" ("kind", "created_at" DESC);

CREATE INDEX "leads_status_created_idx" ON "public"."leads" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "maintenance_logs_equipment_idx" ON "public"."maintenance_logs" USING "btree" ("equipment_id", "service_date" DESC);

CREATE INDEX "maintenance_logs_vehicle_idx" ON "public"."maintenance_logs" USING "btree" ("vehicle_id", "service_date" DESC);

CREATE INDEX "photos_property_created_idx" ON "public"."photos" USING "btree" ("property_id", "created_at" DESC);

CREATE UNIQUE INDEX "property_route_groups_property_idx" ON "public"."property_route_groups" USING "btree" ("property_id");

CREATE INDEX "site_collection_items_order_idx" ON "public"."site_collection_items" USING "btree" ("collection", "sort_order") WHERE "published";

CREATE INDEX "site_content_page_idx" ON "public"."site_content" USING "btree" ("page");

CREATE INDEX "visit_crew_employee_idx" ON "public"."visit_crew" USING "btree" ("employee_id", "relation");

CREATE INDEX "visits_in_progress_idx" ON "public"."visits" USING "btree" ("id") WHERE (("started_at" IS NOT NULL) AND ("ended_at" IS NULL));

CREATE UNIQUE INDEX "visits_property_week_idx" ON "public"."visits" USING "btree" ("property_id", "week_start");

CREATE INDEX "visits_uninvoiced_idx" ON "public"."visits" USING "btree" ("id") WHERE (("status" = 'completed'::"text") AND ("invoice_id" IS NULL));

CREATE OR REPLACE TRIGGER "enforce_accountant_columns" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_accountant_account_columns"();

CREATE OR REPLACE TRIGGER "photos_crew_caption_only_trigger" BEFORE UPDATE ON "public"."photos" FOR EACH ROW EXECUTE FUNCTION "public"."photos_crew_caption_only"();

CREATE OR REPLACE TRIGGER "set_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_equipment_updated_at" BEFORE UPDATE ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_integrations_updated_at" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_maintenance_logs_updated_at" BEFORE UPDATE ON "public"."maintenance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_properties_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_route_groups_updated_at" BEFORE UPDATE ON "public"."route_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_site_collection_items_updated_at" BEFORE UPDATE ON "public"."site_collection_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_site_content_updated_at" BEFORE UPDATE ON "public"."site_content" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_visits_updated_at" BEFORE UPDATE ON "public"."visits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_converted_account_id_fkey" FOREIGN KEY ("converted_account_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id");

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id");

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_route_groups"
    ADD CONSTRAINT "property_route_groups_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_route_groups"
    ADD CONSTRAINT "property_route_groups_route_group_id_fkey" FOREIGN KEY ("route_group_id") REFERENCES "public"."route_groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id");

ALTER TABLE ONLY "public"."visit_crew"
    ADD CONSTRAINT "visit_crew_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");

ALTER TABLE ONLY "public"."visit_crew"
    ADD CONSTRAINT "visit_crew_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");

ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");

ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");

ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_insert" ON "public"."accounts" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "accounts_select" ON "public"."accounts" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text", 'accountant'::"text"])));

CREATE POLICY "accounts_update" ON "public"."accounts" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"])));

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "employees_select" ON "public"."employees" FOR SELECT USING ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text", 'crew'::"text"])) OR ("user_id" = "auth"."uid"())));

CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE USING (("public"."get_my_role"() = 'owner'::"text")) WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_insert" ON "public"."equipment" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "equipment_select" ON "public"."equipment" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text"])));

CREATE POLICY "equipment_update" ON "public"."equipment" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_insert" ON "public"."integrations" FOR INSERT WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "integrations_select" ON "public"."integrations" FOR SELECT USING (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "integrations_update" ON "public"."integrations" FOR UPDATE USING (("public"."get_my_role"() = 'owner'::"text")) WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_insert" ON "public"."invoices" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"])));

CREATE POLICY "invoices_update" ON "public"."invoices" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"])));

ALTER TABLE "public"."lead_submissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_insert_anon" ON "public"."leads" FOR INSERT TO "anon" WITH CHECK ((("status" = 'new'::"text") AND ("source" = 'website'::"text") AND ("converted_account_id" IS NULL)));

CREATE POLICY "leads_insert_staff" ON "public"."leads" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "leads_select" ON "public"."leads" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "leads_update" ON "public"."leads" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."maintenance_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_logs_delete" ON "public"."maintenance_logs" FOR DELETE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "maintenance_logs_insert" ON "public"."maintenance_logs" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "maintenance_logs_select" ON "public"."maintenance_logs" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text"])));

CREATE POLICY "maintenance_logs_update" ON "public"."maintenance_logs" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_delete" ON "public"."photos" FOR DELETE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "photos_insert" ON "public"."photos" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text"])));

CREATE POLICY "photos_select" ON "public"."photos" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text", 'accountant'::"text"])));

CREATE POLICY "photos_update" ON "public"."photos" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "photos_update_own_caption" ON "public"."photos" FOR UPDATE USING ((("public"."get_my_role"() = 'crew'::"text") AND ("uploaded_by" = "public"."get_my_employee_id"()))) WITH CHECK ((("public"."get_my_role"() = 'crew'::"text") AND ("uploaded_by" = "public"."get_my_employee_id"())));

ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_insert" ON "public"."properties" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "properties_select" ON "public"."properties" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text", 'accountant'::"text"])));

CREATE POLICY "properties_update" ON "public"."properties" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."property_route_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_route_groups_delete" ON "public"."property_route_groups" FOR DELETE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "property_route_groups_insert" ON "public"."property_route_groups" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "property_route_groups_select" ON "public"."property_route_groups" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text", 'accountant'::"text"])));

CREATE POLICY "property_route_groups_update" ON "public"."property_route_groups" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."route_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_groups_delete" ON "public"."route_groups" FOR DELETE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "route_groups_insert" ON "public"."route_groups" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "route_groups_select" ON "public"."route_groups" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text", 'accountant'::"text"])));

CREATE POLICY "route_groups_update" ON "public"."route_groups" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."site_collection_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_collection_items_delete" ON "public"."site_collection_items" FOR DELETE TO "authenticated" USING (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "site_collection_items_insert" ON "public"."site_collection_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "site_collection_items_select" ON "public"."site_collection_items" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "site_collection_items_update" ON "public"."site_collection_items" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'owner'::"text")) WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_content_insert" ON "public"."site_content" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

CREATE POLICY "site_content_select" ON "public"."site_content" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "site_content_update" ON "public"."site_content" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'owner'::"text")) WITH CHECK (("public"."get_my_role"() = 'owner'::"text"));

ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_insert" ON "public"."vehicles" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "vehicles_select" ON "public"."vehicles" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'crew'::"text"])));

CREATE POLICY "vehicles_update" ON "public"."vehicles" FOR UPDATE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"]))) WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

ALTER TABLE "public"."visit_crew" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_crew_delete" ON "public"."visit_crew" FOR DELETE USING ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])) OR ("public"."get_my_role"() = 'crew'::"text")));

CREATE POLICY "visit_crew_insert" ON "public"."visit_crew" FOR INSERT WITH CHECK ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])) OR (("public"."get_my_role"() = 'crew'::"text") AND ("relation" = 'assigned'::"text")) OR (("public"."get_my_role"() = 'crew'::"text") AND ("relation" = 'completed'::"text"))));

CREATE POLICY "visit_crew_select" ON "public"."visit_crew" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text", 'crew'::"text"])));

CREATE POLICY "visit_crew_update" ON "public"."visit_crew" FOR UPDATE USING ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])) OR (("public"."get_my_role"() = 'crew'::"text") AND ("employee_id" = "public"."get_my_employee_id"())))) WITH CHECK ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])) OR (("public"."get_my_role"() = 'crew'::"text") AND ("employee_id" = "public"."get_my_employee_id"()))));

ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits_delete" ON "public"."visits" FOR DELETE USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "visits_insert" ON "public"."visits" FOR INSERT WITH CHECK (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text"])));

CREATE POLICY "visits_select" ON "public"."visits" FOR SELECT USING (("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text", 'crew'::"text"])));

CREATE POLICY "visits_update" ON "public"."visits" FOR UPDATE USING ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"])) OR (("public"."get_my_role"() = 'crew'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."visit_crew" "vc"
  WHERE (("vc"."visit_id" = "visits"."id") AND ("vc"."employee_id" = "public"."get_my_employee_id"()))))))) WITH CHECK ((("public"."get_my_role"() = ANY (ARRAY['owner'::"text", 'lead'::"text", 'accountant'::"text"])) OR (("public"."get_my_role"() = 'crew'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."visit_crew" "vc"
  WHERE (("vc"."visit_id" = "visits"."id") AND ("vc"."employee_id" = "public"."get_my_employee_id"())))))));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."leads";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."visit_crew";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."visits";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."enforce_accountant_account_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_accountant_account_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_accountant_account_columns"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_employee_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_employee_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_employee_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";

GRANT ALL ON FUNCTION "public"."photos_crew_caption_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."photos_crew_caption_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."photos_crew_caption_only"() TO "service_role";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";

GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";

GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";

GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";

GRANT ALL ON TABLE "public"."lead_submissions" TO "anon";
GRANT ALL ON TABLE "public"."lead_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_submissions" TO "service_role";

GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";

GRANT ALL ON TABLE "public"."maintenance_logs" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "service_role";

GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";

GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";

GRANT ALL ON TABLE "public"."property_route_groups" TO "anon";
GRANT ALL ON TABLE "public"."property_route_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."property_route_groups" TO "service_role";

GRANT ALL ON TABLE "public"."route_groups" TO "anon";
GRANT ALL ON TABLE "public"."route_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."route_groups" TO "service_role";

GRANT ALL ON TABLE "public"."site_collection_items" TO "anon";
GRANT ALL ON TABLE "public"."site_collection_items" TO "authenticated";
GRANT ALL ON TABLE "public"."site_collection_items" TO "service_role";

GRANT ALL ON TABLE "public"."site_content" TO "anon";
GRANT ALL ON TABLE "public"."site_content" TO "authenticated";
GRANT ALL ON TABLE "public"."site_content" TO "service_role";

GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";

GRANT ALL ON TABLE "public"."visit_crew" TO "anon";
GRANT ALL ON TABLE "public"."visit_crew" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_crew" TO "service_role";

GRANT ALL ON TABLE "public"."visits" TO "anon";
GRANT ALL ON TABLE "public"."visits" TO "authenticated";
GRANT ALL ON TABLE "public"."visits" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- =================================================================
-- SECTION 2 — Storage buckets + storage.objects RLS policies.
-- `supabase db dump` excludes the storage schema entirely (see
-- --exclude-schema in `supabase db dump --dry-run`), so these are
-- hand-carried from their source migrations, consolidated to final
-- state (e.g. the photos bucket's original 10MB/HEIC-allowed limit was
-- superseded by 20260625142525_photos_bucket_update.sql — only the
-- final 20MB/no-HEIC state is included here).
-- =================================================================

-- photos — private, access via signed URLs (visit photos, how-to guides)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  20971520,           -- 20 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects is enabled by default in Supabase.

-- Crew, leads, and owners can upload photos
CREATE POLICY "crew can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND "public"."get_my_role"() IN ('owner', 'lead', 'crew')
);

-- All authenticated staff can view photos (owners, leads, crew, accountants)
CREATE POLICY "staff can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'photos');

-- Owners and leads can delete photos (crew cannot delete their own uploads)
CREATE POLICY "owners and leads can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND "public"."get_my_role"() IN ('owner', 'lead')
);

-- site-media — public (not signed-URL, unlike `photos`): marketing images
-- need stable, cacheable, crawlable URLs. Owner-only writes; anyone can read.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  20971520,           -- 20 MB per file, matching the photos bucket
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public can read site media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'site-media');

CREATE POLICY "owners can upload site media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-media'
  AND "public"."get_my_role"() = 'owner'
);

CREATE POLICY "owners can update site media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-media'
  AND "public"."get_my_role"() = 'owner'
);

CREATE POLICY "owners can delete site media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-media'
  AND "public"."get_my_role"() = 'owner'
);

-- resumes — private (PII), job application uploads (Task 9.6). The
-- uploader is always an anonymous public applicant with no session to
-- scope an INSERT policy by, so uploads happen exclusively server-side
-- via the service-role client (app/(public)/jobs/actions.ts), which
-- bypasses RLS/grants altogether. There is deliberately NO INSERT/
-- UPDATE/DELETE policy for anon OR authenticated — nobody needs one.
-- SELECT is narrower than `photos` (any staff): owner/lead only,
-- matching the leads_select policy above, since resumes are always read
-- through the Leads inbox, never crew/accountant-facing.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  4194304,            -- 4 MB per file
  ARRAY['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "owners and leads can read resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes' AND "public"."get_my_role"() IN ('owner', 'lead'));


-- =================================================================
-- SECTION 3 — site_content + site_collection_items seed content
-- (public marketing copy). `supabase db dump --schema-only` never
-- includes DML, so this is hand-carried from the LIVE rows in the dev
-- project (queried directly, not reassembled from the seed migrations —
-- the owner has since edited several values through the in-app editor,
-- e.g. home.hero_body was upgraded from a plain 'text' slot to
-- 'richtext', and lawn.intro picked up an extra sentence). ON CONFLICT
-- DO NOTHING throughout so this stays safe to re-run and never clobbers
-- a prod owner's own edit if this file is ever replayed.
--
-- NOTE: gardens.hero_image below references a real uploaded file
-- (site-media/gardens-hero_image/de94b204-...jpg) that lives in the DEV
-- project's Storage bucket. This migration creates the `site-media`
-- bucket (Section 2) but does NOT copy the file itself — Storage blobs
-- are not part of a schema/data migration. Either re-upload that image
-- through the site editor once prod is live, or download it from dev's
-- Storage and upload it to prod's `site-media` bucket at the same path
-- before this row is first read by a page. Until then the gardens page
-- falls back to no hero image, not a broken link (see lib/content/
-- defaults.ts / the image component's handling of a missing object).
-- =================================================================

INSERT INTO public.site_content (page, key, kind, value) VALUES
  ('about', 'heading', 'text', '"About Us"'::jsonb),
  ('about', 'intro', 'text', '"We''re a small, local crew who care as much about the ecosystem as we do about your yard."'::jsonb),
  ('about', 'seo_description', 'text', '"Meet the team behind Rooted Gardens and The Electric Lawn."'::jsonb),
  ('about', 'seo_title', 'text', '"About Us"'::jsonb),
  ('contact', 'heading', 'text', '"Get in Touch"'::jsonb),
  ('contact', 'intro', 'text', '"Tell us about your property and which service you''re interested in — we''ll follow up soon."'::jsonb),
  ('contact', 'seo_description', 'text', '"Request a quote from Rooted Gardens or The Electric Lawn."'::jsonb),
  ('contact', 'seo_title', 'text', '"Contact"'::jsonb),
  ('faq', 'heading', 'text', '"Frequently Asked Questions"'::jsonb),
  ('faq', 'intro', 'text', '"Answers to what we hear most. Don''t see yours? Reach out."'::jsonb),
  ('faq', 'seo_description', 'text', '"Common questions about Rooted Gardens and The Electric Lawn services."'::jsonb),
  ('faq', 'seo_title', 'text', '"FAQ"'::jsonb),
  ('gardens', 'heading', 'text', '"Rooted Gardens"'::jsonb),
  ('gardens', 'hero_image', 'image', '"site-media/gardens-hero_image/de94b204-80a4-4e98-a45d-6fdc9f6532fe.jpg"'::jsonb),
  ('gardens', 'intro', 'text', '"Ecological garden design, installation, and maintenance that works with the land, not against it."'::jsonb),
  ('gardens', 'seo_description', 'text', '"Ecological garden design, installation, and maintenance in the Upper Valley."'::jsonb),
  ('gardens', 'seo_title', 'text', '"Garden Design & Installation"'::jsonb),
  ('global', 'blog_url', 'url', '"https://myrootedgardens.com/blog"'::jsonb),
  ('global', 'credentials_line', 'text', '"Fully Insured · Equal Opportunity Employer · Environmentally Minded · Proud member of the Ecological Landscape Alliance"'::jsonb),
  ('global', 'garden_contact_email', 'email', '"krystyna@myrootedgardens.com"'::jsonb),
  ('global', 'garden_contact_name', 'text', '"Krystyna"'::jsonb),
  ('global', 'garden_contact_phone', 'phone', '"(802) 281-0781"'::jsonb),
  ('global', 'lawn_contact_email', 'email', '"matt@myrootedgardens.com"'::jsonb),
  ('global', 'lawn_contact_name', 'text', '"Matt"'::jsonb),
  ('global', 'lawn_contact_phone', 'phone', '"(802) 291-2228"'::jsonb),
  ('global', 'mailing_address', 'text', '"PO Box 501, Norwich, VT 05055"'::jsonb),
  ('global', 'org_name', 'text', '"Rooted Gardens"'::jsonb),
  ('global', 'org_tagline', 'text', '"Rooted Gardens mindfully cares for your property to maximize your family''s enjoyment while simultaneously benefiting the surrounding ecosystem."'::jsonb),
  ('global', 'parent_company', 'text', '"Tigertown Farm LLC"'::jsonb),
  ('global', 'social_facebook', 'url', '"https://www.facebook.com/myRootedGardens"'::jsonb),
  ('global', 'social_instagram', 'url', '"https://www.instagram.com/myrootedgardens"'::jsonb),
  ('home', 'cta_label', 'text', '"Get a quote"'::jsonb),
  ('home', 'hero_body', 'richtext', '{"doc": {"type": "doc", "content": [{"type": "paragraph", "content": [{"text": "Rooted Gardens mindfully cares for your property to maximize your family''s enjoyment while simultaneously benefiting the surrounding ecosystems.", "type": "text"}]}]}, "html": "<p>Rooted Gardens mindfully cares for your property to maximize your family''s enjoyment while simultaneously benefiting the surrounding ecosystems.</p>"}'::jsonb),
  ('home', 'hero_heading', 'text', '"Your yard, part of a connected ecosystem"'::jsonb),
  ('home', 'seo_description', 'text', '"The Electric Lawn and Rooted Gardens — eco-minded lawn care and garden design serving the Upper Valley."'::jsonb),
  ('home', 'seo_title', 'text', '"Eco-Landscaping in Norwich, VT"'::jsonb),
  ('jobs', 'heading', 'text', '"Join the Crew"'::jsonb),
  ('jobs', 'intro', 'text', '"We''re a small, local team that cares about doing this work right. Open positions below."'::jsonb),
  ('jobs', 'seo_description', 'text', '"Career opportunities with Rooted Gardens, an equal opportunity employer in Norwich, VT."'::jsonb),
  ('jobs', 'seo_title', 'text', '"Jobs"'::jsonb),
  ('lawn', 'heading', 'text', '"The Electric Lawn"'::jsonb),
  ('lawn', 'intro', 'text', '"Weekly, route-based electric mowing — quiet, emissions-free, and easy on the neighborhood.  We are the best at keeping it clean."'::jsonb),
  ('lawn', 'seo_description', 'text', '"Electric mowing, trimming, and edging for Upper Valley lawns."'::jsonb),
  ('lawn', 'seo_title', 'text', '"The Electric Lawn"'::jsonb)
ON CONFLICT (page, key) DO NOTHING;

INSERT INTO public.site_collection_items (collection, sort_order, published, data) VALUES
  ('faq', 0, true, '{"answer": "We''re based in Norwich, VT and serve most of the Upper Valley in person. Outside that range, we can sometimes do a virtual design consultation instead.", "question": "What areas do you serve?"}'::jsonb),
  ('faq', 1, true, '{"answer": "Full-service lawn and garden care — pruning in early spring, edging and mulching through the growing season, and ongoing maintenance all summer. We steer clear of invasive species and focus on work that builds habitat rather than just tidying up.", "question": "What kind of work do you take on?"}'::jsonb),
  ('faq', 2, true, '{"answer": "Anywhere from a small pollinator bed to a multi-year plan to convert lawn into habitat. We also partner with existing landscaping crews on the ecological side of a larger project.", "question": "How big (or small) can a project be?"}'::jsonb),
  ('faq', 3, true, '{"answer": "Deer pressure is real in this region. We lean on deer-resistant plant choices, and for some properties we''ll talk with you about ethical hunting as part of a longer-term balance.", "question": "What about deer?"}'::jsonb),
  ('faq', 4, true, '{"answer": "Designing and maintaining a landscape with the site''s ecology in mind — choosing and caring for plants in a way that supports the pollinators, birds, and soil life around it, not just how it looks.", "question": "What do you mean by \"ecological gardening\"?"}'::jsonb),
  ('job', 0, true, '{"blurb": "Seasonal mowing crew position. No experience required — we train.", "title": "Crew Member — The Electric Lawn", "location": "Norwich, VT"}'::jsonb),
  ('job', 1, true, '{"blurb": "Guide teams, interface with home owners, drive trucks.", "title": "Crew Lead", "location": "Norwich, VT"}'::jsonb),
  ('team', 0, true, '{"bio": "Krystyna (she/her) studied environmental science and studio art at Dartmouth and has spent the past decade helping homeowners rethink what their yard can do for the ecosystem around it.", "name": "Krystyna Oszkinis", "role": "Owner & Lead Designer", "image_path": null}'::jsonb),
  ('team', 1, true, '{"bio": "Matt runs the lawn and equipment side of the business — routes, mowers, and making sure the crew has what they need to do the job right.", "name": "Matt Stuart", "role": "Owner", "image_path": null}'::jsonb),
  ('team', 2, true, '{"bio": "Jane came to gardening from a coaching background and brings the same patience to helping native plantings get established.", "name": "Jane LeMasurier", "role": "Garden Guru", "image_path": null}'::jsonb),
  ('team', 3, true, '{"bio": "Sarah (they/she) has a background in soil science and leads on the \"why\" behind our practices — healthy dirt matters as much as what''s planted in it.", "name": "Sarah Goldsmith", "role": "Garden Guru & Education Coordinator", "image_path": null}'::jsonb)
;
