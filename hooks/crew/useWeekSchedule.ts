'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { buildScheduleWeek, type ScheduleAssignment } from '@/lib/utils/schedule'
import type { RouteGroup, ScheduleWeek, VisitWithCrew } from '@/types/app'

/**
 * Client-first version of the management `getScheduleForWeek` Server Action.
 * Crew use this to see the full week's schedule (all route groups + assigned
 * crew) so they can self-organize coverage. Uses the browser Supabase client so
 * the result participates in the IndexedDB React Query cache and is readable
 * offline (stale). RLS now permits crew to read all visits / visit_crew / the
 * roster (see 20260628150000_crew_schedule_visibility.sql).
 */
export function useWeekSchedule(weekStart: Date) {
  const weekStartISO = format(weekStart, 'yyyy-MM-dd')

  return useQuery<ScheduleWeek>({
    queryKey: ['crew-week-schedule', weekStartISO],
    queryFn: async () => {
      const supabase = createClient()

      const [routeGroupsResult, assignmentsResult, visitsResult] = await Promise.all([
        supabase.from('route_groups').select('*').order('sort_order', { ascending: true }),
        supabase.from('property_route_groups').select(`
          property_id,
          route_group_id,
          sort_order,
          property:properties(
            *,
            account:accounts(*),
            service_zones(*)
          )
        `),
        supabase
          .from('visits')
          .select(`*, visit_crew(*, employee:employees(*)), visit_sessions(id, started_at, ended_at, employee_id)`)
          .eq('week_start', weekStartISO),
      ])

      if (routeGroupsResult.error) throw routeGroupsResult.error
      if (assignmentsResult.error) throw assignmentsResult.error
      if (visitsResult.error) throw visitsResult.error

      const routeGroups = (routeGroupsResult.data ?? []) as RouteGroup[]
      const assignments = (assignmentsResult.data ?? []) as unknown as ScheduleAssignment[]
      const visits = (visitsResult.data ?? []) as unknown as VisitWithCrew[]

      return buildScheduleWeek(weekStartISO, routeGroups, assignments, visits)
    },
    staleTime: 60_000,
  })
}
