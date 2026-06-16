-- =================================================================
-- 003 — RLS policies for property_route_groups + route_groups DELETE
-- =================================================================
-- property_route_groups had RLS enabled (from migration 001) but zero
-- policies — all assignment reads/writes were denied. This migration
-- adds the missing policies so owners/leads can assign properties to
-- route groups, and adds a DELETE policy for route_groups so empty
-- groups can be removed from the UI.
--
-- Reuses the get_my_role() helper from migration 002.
-- No schema changes — no type regen required.
-- =================================================================


-- =================================================================
-- PROPERTY_ROUTE_GROUPS — join table (property ↔ route group)
-- =================================================================

-- All four roles can read assignments (needed for schedule/crew views).
CREATE POLICY property_route_groups_select
  ON public.property_route_groups
  FOR SELECT
  USING (get_my_role() IN ('owner', 'lead', 'crew', 'accountant'));

-- Only owners and leads may create assignments.
CREATE POLICY property_route_groups_insert
  ON public.property_route_groups
  FOR INSERT
  WITH CHECK (get_my_role() IN ('owner', 'lead'));

-- Owners and leads may update sort_order on assignments.
CREATE POLICY property_route_groups_update
  ON public.property_route_groups
  FOR UPDATE
  USING     (get_my_role() IN ('owner', 'lead'))
  WITH CHECK(get_my_role() IN ('owner', 'lead'));

-- Owners and leads may remove a property from a route group.
CREATE POLICY property_route_groups_delete
  ON public.property_route_groups
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));


-- =================================================================
-- ROUTE_GROUPS — allow owners/leads to delete empty route groups
-- =================================================================

CREATE POLICY route_groups_delete
  ON public.route_groups
  FOR DELETE
  USING (get_my_role() IN ('owner', 'lead'));
