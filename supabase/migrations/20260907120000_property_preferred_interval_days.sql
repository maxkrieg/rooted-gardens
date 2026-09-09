-- Per-property override for the service interval, in days.
--
-- properties.frequency is a coarse word — weekly | biweekly | monthly |
-- as_needed — and it answers "what's the plan", never "how long has this one
-- actually been waiting". Owners needed a number they could tune: a "weekly"
-- property the customer wants on a 10-day rhythm, or an as_needed property that
-- should still raise a flag once it's been a month.
--
-- NULL is the normal case and means "derive from frequency" — the default map
-- lives in lib/utils/cadence.ts (FREQUENCY_DEFAULT_INTERVAL_DAYS), not here.
-- Storing the derived value instead was rejected: it would have to be rewritten
-- on every frequency change, and a stale copy is worse than a derivation.
--
-- as_needed has no default interval, so a NULL there means no overdue signal at
-- all. Setting a number is exactly how an owner opts that property in.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS preferred_interval_days integer;

-- Upper bound is a sanity rail, not a business rule: a year is already well past
-- anything this company schedules, and it stops a fat-fingered 3650 from
-- silently disabling the overdue warning.
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_preferred_interval_days_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_preferred_interval_days_check
  CHECK (preferred_interval_days IS NULL OR preferred_interval_days BETWEEN 1 AND 365);

COMMENT ON COLUMN public.properties.preferred_interval_days IS
  'Owner override for the service interval in days. NULL derives from frequency — see FREQUENCY_DEFAULT_INTERVAL_DAYS in lib/utils/cadence.ts.';
