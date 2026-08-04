-- Fixes a pre-existing gap discovered while building 9.1 (leads): the
-- `supabase_realtime` publication exists on this project (confirmed via
-- `supabase db query --linked` — puballtables = false, i.e. it's a curated
-- publication, not FOR ALL TABLES) but has never had any tables added to it.
-- The `postgres_changes` subscriptions in components/management/
-- SessionsProvider.tsx, components/management/CrewsOnSitePanel.tsx, and
-- hooks/crew/useCrewRealtimeSync.ts have therefore silently never delivered
-- a single event — the schedule's in-progress overlay, the dashboard's
-- "Crews on site now" live pulse, and the crew assignment/schedule sync are
-- all only ever as fresh as the last page load.
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_crew;
