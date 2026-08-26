'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { patchScheduleVisit, scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import { nextVisitVersion } from '@/lib/utils/visits'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import type { Employee, SchedulePropertyRow, VisitWithCrew, VisitCrewWithEmployee } from '@/types/app'

/**
 * Bulk versions of the per-visit schedule mutations, for select mode.
 *
 * These enqueue the *existing* mutation types in a loop rather than adding a
 * bulk type, which is what makes them work offline for free: the queue already
 * knows how to replay each one, and a partially-flushed batch resumes rather
 * than being lost. The per-visit hooks can't be reused directly because they're
 * hooks bound to one visitId — the enqueue and the cache patch are lifted here
 * instead.
 *
 * Every call flushes once at the end, not once per row: online that's one pass
 * over the queue, offline it's a no-op either way.
 */
export function useBulkScheduleActions(weekStart: string) {
  const queryClient = useQueryClient()
  const createVisit = useCreateVisit()

  /** Rows with no visit yet get one, so crew/truck have something to attach to. */
  const ensureVisits = useCallback(
    async (rows: SchedulePropertyRow[]): Promise<Array<{ row: SchedulePropertyRow; visitId: string }>> => {
      const out: Array<{ row: SchedulePropertyRow; visitId: string }> = []
      for (const row of rows) {
        if (row.visit) {
          out.push({ row, visitId: row.visit.id })
        } else {
          const visit = await createVisit(row, weekStart)
          out.push({ row, visitId: visit.id })
        }
      }
      return out
    },
    [createVisit, weekStart],
  )

  const scheduleAll = useCallback(
    async (rows: SchedulePropertyRow[]) => {
      const pending = rows.filter((row) => !row.visit)
      await ensureVisits(pending)
      await flushMutationQueue()
      return pending.length
    },
    [ensureVisits],
  )

  const assignCrew = useCallback(
    async (rows: SchedulePropertyRow[], employee: Employee, action: 'add' | 'remove') => {
      const targets = await ensureVisits(rows)
      for (const { visitId } of targets) {
        await enqueueMutation('assign_crew', { visitId, employeeId: employee.id, action })
        patchScheduleVisit(queryClient, visitId, (visit) => ({
          ...visit,
          visit_crew:
            action === 'add'
              ? visit.visit_crew.some(
                  (vc) => vc.employee_id === employee.id && vc.relation === 'assigned',
                )
                ? visit.visit_crew
                : [
                    ...visit.visit_crew,
                    {
                      visit_id: visitId,
                      employee_id: employee.id,
                      relation: 'assigned',
                      created_at: new Date().toISOString(),
                      employee: { id: employee.id, name: employee.name },
                    } as VisitCrewWithEmployee,
                  ]
              : visit.visit_crew.filter(
                  (vc) => !(vc.employee_id === employee.id && vc.relation === 'assigned'),
                ),
        }))
      }
      await flushMutationQueue()
      return targets.length
    },
    [ensureVisits, queryClient],
  )

  const setVehicle = useCallback(
    async (rows: SchedulePropertyRow[], vehicleId: string | null) => {
      const targets = await ensureVisits(rows)
      for (const { visitId } of targets) {
        await enqueueMutation('set_vehicle', { visitId, vehicleId })
        patchScheduleVisit(queryClient, visitId, (visit) => ({
          ...visit,
          vehicle_id: vehicleId,
          updated_at: nextVisitVersion(visit.updated_at),
        }))
      }
      await flushMutationQueue()
      return targets.length
    },
    [ensureVisits, queryClient],
  )

  /** Only touches rows that already have a visit — there's nothing to skip otherwise. */
  const skipAll = useCallback(
    async (rows: SchedulePropertyRow[], skipReason: string) => {
      const targets = rows.filter((row) => row.visit && row.visit.status !== 'skipped')
      for (const row of targets) {
        const visitId = row.visit!.id
        await enqueueMutation('skip', { visitId, skipReason }, row.property.address)
        patchScheduleVisit(queryClient, visitId, (visit) => ({
          ...visit,
          status: 'skipped',
          skip_reason: skipReason,
          updated_at: nextVisitVersion(visit.updated_at),
        }))
      }
      await flushMutationQueue()
      return targets.length
    },
    [queryClient],
  )

  /** Drops the locally-minted rows a failed batch left behind, on demand. */
  const invalidateWeek = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: scheduleVisitsKey(weekStart) })
  }, [queryClient, weekStart])

  return { scheduleAll, assignCrew, setVehicle, skipAll, invalidateWeek }
}

export type BulkScheduleActions = ReturnType<typeof useBulkScheduleActions>

/** Narrowing helper so callers don't re-derive "does this row have a visit". */
export function rowsWithVisits(rows: SchedulePropertyRow[]): Array<SchedulePropertyRow & { visit: VisitWithCrew }> {
  return rows.filter((row): row is SchedulePropertyRow & { visit: VisitWithCrew } => !!row.visit)
}
