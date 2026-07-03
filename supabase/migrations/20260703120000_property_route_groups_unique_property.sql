-- A property belongs to exactly one route group at a time (crew routes are
-- exclusive — a property can't be worked by two different daily routes).
-- Enforced here as a safety net; the primary UX prevention lives in the
-- Assign Properties sheet (app/management/route-groups).
CREATE UNIQUE INDEX property_route_groups_property_idx
  ON public.property_route_groups (property_id);
