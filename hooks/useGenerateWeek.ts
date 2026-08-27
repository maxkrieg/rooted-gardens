'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { patchScheduleVisit, useScheduleReference } from '@/hooks/useManagementSchedule'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import { nextVisitVersion } from '@/lib/utils/visits'
import { planWeek, type PlanCandidate, type PlanDecision } from '@/lib/utils/schedule'
import type {
  Account,
  Property,
  RouteGroup,
  ScheduleWeek,
  VisitCrewWithEmployee,
} from '@/types/app'

export const propertyLastVisitKey = ['property-last-visit'] as const

/** Most recent completed visit per property — what phases biweekly and monthly. */
export function usePropertyLastVisit() {
  return useQuery({
    queryKey: propertyLastVisitKey,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('property_last_visit').select('*')
      if (error) throw error
      const byProperty = new Map<string, string>()
      for (const row of data ?? []) {
        if (row.property_id && row.last_visit_at) {
          byProperty.set(row.property_id, format(parseISO(row.last_visit_at), 'yyyy-MM-dd'))
        }
      }
      return byProperty
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * The generate-week plan for one week: every property the owner could schedule,
 * with a due/not-due verdict and the reason.
 *
 * Read-only by construction — this is what the preview renders, and R3.5's
 * confirm step writes exactly the subset the owner leaves ticked.
 */
export function useWeekPlan(weekStart: string, week: ScheduleWeek | undefined) {
  const reference = useScheduleReference()
  const lastVisit = usePropertyLastVisit()

  const candidates: PlanCandidate[] = []
  if (week) {
    const rows = [...week.routeGroups.flatMap((g) => g.rows), ...week.ungrouped]
    for (const row of rows) {
      candidates.push({
        property: row.property,
        account: row.account,
        routeGroup: row.routeGroup,
        lastVisitedOn: lastVisit.data?.get(row.property.id) ?? null,
        hasVisitThisWeek: !!row.visit,
      })
    }
  }

  return {
    decisions: planWeek(weekStart, candidates),
    isLoading: reference.isLoading || lastVisit.isLoading,
    // The plan is wrong without visit history, not merely incomplete: every
    // biweekly property would read as "never visited" and come up due.
    isError: lastVisit.isError,
  }
}

/**
 * Create the visits the owner confirmed, pre-filled from each route group's
 * defaults.
 *
 * One `create_visit` per property plus `assign_crew` / `set_vehicle` from the
 * group defaults — all existing mutation types, so this queues and replays like
 * anything else and needs no online-only gate. `create_visit` mints its id on
 * the device and upserts on (property_id, week_start), which is what makes a
 * second run a no-op rather than a duplicate.
 */
export function useGenerateWeek(weekStart: string) {
  const queryClient = useQueryClient()
  const createVisit = useCreateVisit()
  const reference = useScheduleReference()

  return useCallback(
    async (decisions: PlanDecision[]): Promise<number> => {
      const routeGroups = reference.data?.routeGroups ?? []
      const defaultCrew = reference.data?.defaultCrew ?? []

      for (const { candidate } of decisions) {
        const visit = await createVisit(
          {
            property: candidate.property as Property,
            account: candidate.account as Account,
            routeGroup: candidate.routeGroup as RouteGroup | null,
            visit: null,
          },
          weekStart,
          candidate.property.address,
        )

        const groupId = candidate.routeGroup?.id
        if (!groupId) continue

        const group = routeGroups.find((g) => g.id === groupId)
        if (group?.default_vehicle_id) {
          await enqueueMutation('set_vehicle', {
            visitId: visit.id,
            vehicleId: group.default_vehicle_id,
          })
          patchScheduleVisit(queryClient, visit.id, (v) => ({
            ...v,
            vehicle_id: group.default_vehicle_id,
            updated_at: nextVisitVersion(v.updated_at),
          }))
        }

        for (const row of defaultCrew.filter((c) => c.route_group_id === groupId)) {
          await enqueueMutation('assign_crew', {
            visitId: visit.id,
            employeeId: row.employee_id,
            action: 'add',
          })
          const employee = row.employee
          if (!employee) continue
          patchScheduleVisit(queryClient, visit.id, (v) => ({
            ...v,
            visit_crew: [
              ...v.visit_crew,
              {
                visit_id: visit.id,
                employee_id: row.employee_id,
                relation: 'assigned',
                created_at: new Date().toISOString(),
                employee: { id: row.employee_id, name: employee.name },
              } as VisitCrewWithEmployee,
            ],
          }))
        }
      }

      await flushMutationQueue()
      return decisions.length
    },
    [createVisit, queryClient, reference.data, weekStart],
  )
}
