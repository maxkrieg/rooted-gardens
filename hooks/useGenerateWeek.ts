'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { patchScheduleVisit, useScheduleReference } from '@/hooks/useManagementSchedule'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import { nextVisitVersion } from '@/lib/utils/visits'
import { planWeek, type PlanCandidate, type PlanDecision } from '@/lib/utils/schedule'
import { usePropertyLastVisit } from '@/hooks/usePropertyLastVisit'
import type {
  Account,
  Property,
  RouteGroup,
  ScheduleWeek,
  VisitCrewWithEmployee,
} from '@/types/app'

/** The generate-week plan: every property with a due verdict and reason. Read-only. */
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
        lastVisitedOn: lastVisit.data?.[row.property.id] ?? null,
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
 * Create the confirmed visits with route defaults, using existing queue types. create_visit
 * upserts on (property_id, week_start), so a second run is a no-op.
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
