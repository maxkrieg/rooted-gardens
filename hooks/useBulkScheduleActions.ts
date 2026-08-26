'use client'

import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { patchScheduleVisit, scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import { nextVisitVersion } from '@/lib/utils/visits'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import type { Employee, SchedulePropertyRow, VisitCrewWithEmployee } from '@/types/app'

/**
 * What a bulk apply did, and how to take it back.
 *
 * `undo` is absent when the action can't be reversed — scheduling mints visits
 * and there is no delete-visit mutation, and a visit crew may already have
 * started isn't safe to remove blind.
 */
export interface BulkResult {
  changed: number
  undo?: () => Promise<void>
}

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
 * Undo is built from the same primitives, so it queues and survives a dead zone
 * exactly like the change it reverses.
 */
export function useBulkScheduleActions(weekStart: string) {
  const queryClient = useQueryClient()
  const createVisit = useCreateVisit()

  /** Rows with no visit yet get one, so crew/truck have something to attach to. */
  const ensureVisits = useCallback(
    async (rows: SchedulePropertyRow[]): Promise<string[]> => {
      const ids: string[] = []
      for (const row of rows) {
        if (row.visit) ids.push(row.visit.id)
        else ids.push((await createVisit(row, weekStart)).id)
      }
      return ids
    },
    [createVisit, weekStart],
  )

  const scheduleAll = useCallback(
    async (rows: SchedulePropertyRow[]): Promise<BulkResult> => {
      const pending = rows.filter((row) => !row.visit)
      await ensureVisits(pending)
      await flushMutationQueue()
      // No undo: reversing this means deleting visits, and there is no
      // delete-visit mutation type — deliberately, since a visit crew may have
      // already started can't be removed safely.
      return { changed: pending.length }
    },
    [ensureVisits],
  )

  const assignCrew = useCallback(
    async (rows: SchedulePropertyRow[], employee: Employee): Promise<BulkResult> => {
      const visitIds = await ensureVisits(rows)

      // Only the visits this actually changed are undoable — reversing a visit
      // that already had them on it would remove an assignment we didn't make.
      const added = visitIds.filter((visitId) => {
        const row = rows.find((r) => r.visit?.id === visitId)
        return !row?.visit?.visit_crew.some(
          (vc) => vc.employee_id === employee.id && vc.relation === 'assigned',
        )
      })

      await applyCrew(queryClient, added, employee, 'add')
      await flushMutationQueue()

      return {
        changed: added.length,
        undo:
          added.length > 0
            ? async () => {
                await applyCrew(queryClient, added, employee, 'remove')
                await flushMutationQueue()
              }
            : undefined,
      }
    },
    [ensureVisits, queryClient],
  )

  const setVehicle = useCallback(
    async (rows: SchedulePropertyRow[], vehicleId: string | null): Promise<BulkResult> => {
      // Captured before the write: undo restores each visit's own previous
      // truck, not one shared value.
      const previous = new Map<string, string | null>()
      for (const row of rows) {
        if (row.visit) previous.set(row.visit.id, row.visit.vehicle_id)
      }

      const visitIds = await ensureVisits(rows)
      const targets = visitIds.filter((id) => (previous.get(id) ?? null) !== vehicleId)

      await applyVehicle(
        queryClient,
        targets.map((visitId) => ({ visitId, vehicleId })),
      )
      await flushMutationQueue()

      return {
        changed: targets.length,
        undo:
          targets.length > 0
            ? async () => {
                await applyVehicle(
                  queryClient,
                  targets.map((visitId) => ({
                    visitId,
                    vehicleId: previous.get(visitId) ?? null,
                  })),
                )
                await flushMutationQueue()
              }
            : undefined,
      }
    },
    [ensureVisits, queryClient],
  )

  /**
   * Only scheduled visits. Nothing to skip on a row with no visit, and skipping
   * a completed one would make undo lossy — `revert_status` sets 'scheduled',
   * so it can't put a completion back.
   */
  const skipAll = useCallback(
    async (rows: SchedulePropertyRow[], skipReason: string): Promise<BulkResult> => {
      const targets = rows.filter((row) => row.visit?.status === 'scheduled')

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

      const visitIds = targets.map((row) => row.visit!.id)
      return {
        changed: targets.length,
        undo:
          visitIds.length > 0
            ? async () => {
                for (const visitId of visitIds) {
                  await enqueueMutation('revert_status', { visitId })
                  patchScheduleVisit(queryClient, visitId, (visit) => ({
                    ...visit,
                    status: 'scheduled',
                    skip_reason: null,
                    updated_at: nextVisitVersion(visit.updated_at),
                  }))
                }
                await flushMutationQueue()
              }
            : undefined,
      }
    },
    [queryClient],
  )

  /** Drops locally-minted rows a failed batch left behind, on demand. */
  const invalidateWeek = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: scheduleVisitsKey(weekStart) })
  }, [queryClient, weekStart])

  return { scheduleAll, assignCrew, setVehicle, skipAll, invalidateWeek }
}

/** Enqueue + optimistic patch for one crew change across many visits. */
async function applyCrew(
  queryClient: QueryClient,
  visitIds: string[],
  employee: Employee,
  action: 'add' | 'remove',
): Promise<void> {
  for (const visitId of visitIds) {
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
}

/** Enqueue + optimistic patch for per-visit vehicle values. */
async function applyVehicle(
  queryClient: QueryClient,
  entries: Array<{ visitId: string; vehicleId: string | null }>,
): Promise<void> {
  for (const { visitId, vehicleId } of entries) {
    await enqueueMutation('set_vehicle', { visitId, vehicleId })
    patchScheduleVisit(queryClient, visitId, (visit) => ({
      ...visit,
      vehicle_id: vehicleId,
      updated_at: nextVisitVersion(visit.updated_at),
    }))
  }
}
