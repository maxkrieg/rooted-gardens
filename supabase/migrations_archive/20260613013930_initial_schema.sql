-- =================================================================
-- 001 — Initial schema for Rooted Gardens business app
-- Tables: accounts, properties, service_zones, route_groups,
--   property_route_groups, employees, vehicles, equipment,
--   visits, visit_crew, visit_sessions, time_entries, photos,
--   integrations
-- =================================================================

-- updated_at trigger — applied to every table that has updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =================================================================
-- ACCOUNTS — billing entities (the people/orgs that get invoices)
-- =================================================================
CREATE TABLE public.accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  billing_type    text        NOT NULL
    CHECK (billing_type IN ('per_visit', 'contract', 'as_needed')),
  price_per_visit numeric(8,2),
  contract_rate   numeric(8,2),
  contract_period text
    CHECK (contract_period IN ('monthly', 'seasonal')),
  status          text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'prospective')),
  qbo_customer_id text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- PROPERTIES — physical locations (an account may have multiple)
-- =================================================================
CREATE TABLE public.properties (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  address       text        NOT NULL,
  lat           numeric(10,7),
  lng           numeric(10,7),
  parking_notes text,
  access_notes  text,
  crew_notes    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- SERVICE_ZONES — named work areas within a property
-- =================================================================
CREATE TABLE public.service_zones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  account_id  uuid        NOT NULL REFERENCES public.accounts(id),
  name        text        NOT NULL,
  frequency   text        NOT NULL
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'as_needed')),
  sort_order  integer     NOT NULL DEFAULT 0,
  notes       text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_service_zones_updated_at
  BEFORE UPDATE ON public.service_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- ROUTE_GROUPS — geographic clusters of properties
-- =================================================================
CREATE TABLE public.route_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_route_groups_updated_at
  BEFORE UPDATE ON public.route_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- PROPERTY_ROUTE_GROUPS — assign properties to route groups
-- =================================================================
CREATE TABLE public.property_route_groups (
  property_id    uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  route_group_id uuid    NOT NULL REFERENCES public.route_groups(id) ON DELETE CASCADE,
  sort_order     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, route_group_id)
);

ALTER TABLE public.property_route_groups ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- EMPLOYEES — people who use the app
-- =================================================================
CREATE TABLE public.employees (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id),
  name        text        NOT NULL,
  phone       text,
  sms_opt_out boolean     NOT NULL DEFAULT false,
  email       text,
  role        text        NOT NULL
    CHECK (role IN ('owner', 'crew', 'accountant', 'lead')),
  side        text
    CHECK (side IN ('lawn', 'garden', 'both')),
  active      boolean     NOT NULL DEFAULT true,
  hourly_rate numeric(6,2),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- VEHICLES
-- =================================================================
CREATE TABLE public.vehicles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  type       text        NOT NULL DEFAULT 'truck',
  plate      text,
  status     text        NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- EQUIPMENT
-- =================================================================
CREATE TABLE public.equipment (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  type          text        NOT NULL
    CHECK (type IN ('mower', 'trimmer', 'blower', 'edger', 'other')),
  status        text        NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  last_serviced date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- VISITS — core operational record: one row per (service_zone × week)
-- week_start is always a Monday.
-- Crew assignment/completion live in visit_crew (NOT as uuid[] arrays).
-- =================================================================
CREATE TABLE public.visits (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_zone_id  uuid        NOT NULL REFERENCES public.service_zones(id),
  account_id       uuid        NOT NULL REFERENCES public.accounts(id),
  property_id      uuid        NOT NULL REFERENCES public.properties(id),
  week_start       date        NOT NULL,
  -- Planning (set by owner/lead before the week)
  crew_instruction text,
  vehicle_id       uuid        REFERENCES public.vehicles(id),
  -- Completion (set by crew in the field)
  status           text        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'skipped', 'invoiced')),
  actual_date      date,
  service_types    text[],
  completion_note  text,
  skip_reason      text,
  -- Billing
  invoiced_at      timestamptz,
  qbo_invoice_id   text,
  invoice_amount   numeric(8,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- VISIT_CREW — crew↔visit assignments and completions (relational join)
-- relation = 'assigned' → planned before the week by owner/lead
-- relation = 'completed' → actually performed, logged by crew in field
-- Replaces uuid[] arrays; supports RLS predicates + Realtime filters.
-- =================================================================
CREATE TABLE public.visit_crew (
  visit_id    uuid        NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.employees(id),
  relation    text        NOT NULL
    CHECK (relation IN ('assigned', 'completed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, employee_id, relation)
);

ALTER TABLE public.visit_crew ENABLE ROW LEVEL SECURITY;

-- For "my stops" queries and Realtime subscriptions filtered by employee
CREATE INDEX visit_crew_employee_idx ON public.visit_crew (employee_id, relation);

-- =================================================================
-- VISIT_SESSIONS — job start/stop tracking (operational on-site time)
-- Distinct from time_entries (payroll shift clock).
-- A visit is "in progress" when it has ≥1 session with ended_at IS NULL.
-- That is a derived state — do NOT add 'in_progress' to visits.status.
-- =================================================================
CREATE TABLE public.visit_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    uuid        NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.employees(id),
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  source      text        NOT NULL DEFAULT 'crew_app'
    CHECK (source IN ('crew_app', 'manual')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visit_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_visit_sessions_updated_at
  BEFORE UPDATE ON public.visit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Partial index: only open sessions — keeps "who's on site now" queries fast
CREATE INDEX visit_sessions_active_idx ON public.visit_sessions (visit_id)
  WHERE ended_at IS NULL;

CREATE INDEX visit_sessions_employee_idx ON public.visit_sessions (employee_id, started_at);

-- =================================================================
-- TIME_ENTRIES — payroll shift clock (daily clock-in/out)
-- Approved for payroll; distinct from visit_sessions (on-site time).
-- =================================================================
CREATE TABLE public.time_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid        NOT NULL REFERENCES public.employees(id),
  visit_id      uuid        REFERENCES public.visits(id),
  date          date        NOT NULL,
  clock_in      timestamptz,
  clock_out     timestamptz,
  break_minutes integer     NOT NULL DEFAULT 0,
  approved      boolean     NOT NULL DEFAULT false,
  approved_by   uuid        REFERENCES public.employees(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- PHOTOS — attached to properties or specific visits
-- =================================================================
CREATE TABLE public.photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid        NOT NULL REFERENCES public.properties(id),
  visit_id     uuid        REFERENCES public.visits(id),
  storage_path text        NOT NULL,
  type         text        NOT NULL DEFAULT 'visit'
    CHECK (type IN ('visit', 'how_to', 'customer_request', 'before', 'after')),
  caption      text,
  uploaded_by  uuid        REFERENCES public.employees(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- INTEGRATIONS — QuickBooks OAuth tokens (encrypted at rest)
-- =================================================================
CREATE TABLE public.integrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service          text        NOT NULL,
  access_token     text,
  refresh_token    text,
  realm_id         text,
  token_expires_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================================================================
-- GRANTS — authenticated role can access all public tables.
-- RLS policies (Phase 2) control which rows each role can touch.
-- anon gets no table grants (no public content in this private app).
-- =================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_zones         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_groups          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_route_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_crew            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_sessions        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations          TO authenticated;
