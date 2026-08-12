-- Drop the payroll shift clock (clock-in/clock-out) feature entirely.
-- The owners don't track employee clock-in/clock-out or run payroll timesheets
-- through this app. Attendance ("who was at which visit") is handled by visit_crew,
-- and per-visit on-site timing by visits.started_at / visits.ended_at — both kept.
-- CASCADE also drops time_entries' RLS policies and its updated_at trigger.
-- employees.hourly_rate is intentionally retained (pay-rate reference, not time tracking).
DROP TABLE IF EXISTS public.time_entries CASCADE;
