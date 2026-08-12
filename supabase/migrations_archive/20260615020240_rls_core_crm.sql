-- =================================================================
-- 002 — RLS policies for core CRM tables
-- Tables: accounts, properties, service_zones, route_groups
-- =================================================================
-- Roles (stored in employees.role, linked via employees.user_id = auth.uid()):
--   owner     — full SELECT / INSERT / UPDATE
--   lead      — full SELECT / INSERT / UPDATE
--   crew      — SELECT only (need property/zone notes on their stops)
--   accountant — SELECT all + UPDATE accounts.qbo_customer_id only
-- DELETE stays blocked for all authenticated users (service-role only).
-- The get_my_role() helper introduced here is reused by task 2.8 for
-- the operational tables (visits, visit_crew, visit_sessions, etc.).


-- =================================================================
-- HELPER — get_my_role()
-- Returns the business role for the current authenticated user by
-- looking up employees.role WHERE user_id = auth.uid().
-- SECURITY DEFINER so the lookup bypasses employees' own RLS
-- (avoids recursion). Returns NULL when there is no matching employee
-- row → all role checks fail closed.
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.employees
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;


-- =================================================================
-- ACCOUNTS — billing entities
-- =================================================================

-- All four roles can read any account row.
CREATE POLICY accounts_select
  ON public.accounts
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

-- Only owners and leads may create new accounts.
CREATE POLICY accounts_insert
  ON public.accounts
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

-- Owners and leads can update anything; accountant can update too
-- but is restricted to qbo_customer_id only (enforced by trigger below).
CREATE POLICY accounts_update
  ON public.accounts
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead', 'accountant'))
  WITH CHECK(get_my_role() IN ('owner', 'lead', 'accountant'));


-- =================================================================
-- ACCOUNTANT COLUMN GUARD — accounts
-- RLS gates rows, not columns. This BEFORE UPDATE trigger enforces
-- that an accountant may only change qbo_customer_id; any attempt
-- to touch other business columns raises an exception.
-- Note: updated_at is excluded from the comparison because the
-- set_accounts_updated_at trigger always bumps it.
-- =================================================================
CREATE OR REPLACE FUNCTION public.enforce_accountant_account_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER enforce_accountant_columns
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accountant_account_columns();


-- =================================================================
-- PROPERTIES — physical locations
-- =================================================================

CREATE POLICY properties_select
  ON public.properties
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

CREATE POLICY properties_insert
  ON public.properties
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY properties_update
  ON public.properties
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));


-- =================================================================
-- SERVICE ZONES — named work areas within a property
-- =================================================================

CREATE POLICY service_zones_select
  ON public.service_zones
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

CREATE POLICY service_zones_insert
  ON public.service_zones
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY service_zones_update
  ON public.service_zones
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));


-- =================================================================
-- ROUTE GROUPS — geographic clusters of properties
-- =================================================================

CREATE POLICY route_groups_select
  ON public.route_groups
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

CREATE POLICY route_groups_insert
  ON public.route_groups
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

CREATE POLICY route_groups_update
  ON public.route_groups
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));
