'use client'

import { useCallback } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { patchScheduleVisit, scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import { nextVisitVersion } from '@/lib/utils/visits'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import type { Employee, SchedulePropertyRow, VisitCrewWithEmployee } from '@/types/app'
import { emitTourEvent } from '@/lib/onboarding/events'

/** What a bulk apply did. `undo` is absent when it can't be reversed (scheduling creates visits). */
/** One stop to act on: a property row and the week its visit belongs to. The
 *  desktop grid selects cells across weeks, so the week travels per target. */
export interface BulkTarget {
  row: SchedulePropertyRow
  weekStart: string
}

export interface BulkResult {
  changed: number
  undo?: () => Promise<void>
}

/**
 * Bulk schedule mutations for select mode. They loop over existing queue types, so they work
 * offline and undo queues the same way.
 */
export function useBulkScheduleActions() {
  const queryClient = useQueryClient()
  const createVisit = useCreateVisit()

  /** Rows with no visit yet get one, so crew/truck have something to attach to. */
  const ensureVisits = useCallback(
    async (targets: BulkTarget[]): Promise<string[]> => {
      const ids: string[] = []
      for (const { row, weekStart } of targets) {
        if (row.visit) ids.push(row.visit.id)
        else ids.push((await createVisit(row, weekStart)).id)
      }
      return ids
    },
    [createVisit],
  )

  const scheduleAll = useCallback(
    async (targets: BulkTarget[]): Promise<BulkResult> => {
      const pending = targets.filter(({ row }) => !row.visit)
      await ensureVisits(pending)
      await flushMutationQueue()
      // No undo: there's no delete-visit mutation.
      return { changed: pending.length }
    },
    [ensureVisits],
  )

  const assignCrew = useCallback(
    async (targets: BulkTarget[], employee: Employee): Promise<BulkResult> => {
      const visitIds = await ensureVisits(targets)

      // Only the visits this actually changed are undoable — reversing a visit
      // that already had them on it would remove an assignment we didn't make.
      const added = visitIds.filter((visitId) => {
        const row = targets.find((t) => t.row.visit?.id === visitId)?.row
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
    async (targets: BulkTarget[], vehicleId: string | null): Promise<BulkResult> => {
      // Captured before the write: undo restores each visit's own previous
      // truck, not one shared value.
      const previous = new Map<string, string | null>()
      for (const { row } of targets) {
        if (row.visit) previous.set(row.visit.id, row.visit.vehicle_id)
      }

      const visitIds = await ensureVisits(targets)
      const changedIds = visitIds.filter((id) => (previous.get(id) ?? null) !== vehicleId)

      await applyVehicle(
        queryClient,
        changedIds.map((visitId) => ({ visitId, vehicleId })),
      )
      await flushMutationQueue()

      return {
        changed: changedIds.length,
        undo:
          changedIds.length > 0
            ? async () => {
                await applyVehicle(
                  queryClient,
                  changedIds.map((visitId) => ({
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

  /** Only scheduled visits: revert_status can't restore a completion, so undo would be lossy. */
  const skipAll = useCallback(
    async (targets: BulkTarget[], skipReason: string): Promise<BulkResult> => {
      const rows = targets.map((t) => t.row).filter((row) => row.visit?.status === 'scheduled')

      for (const row of rows) {
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

      const visitIds = rows.map((row) => row.visit!.id)
      return {
        changed: rows.length,
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
  const invalidateWeeks = useCallback(
    (targets: BulkTarget[]) => {
      for (const weekStart of new Set(targets.map((t) => t.weekStart))) {
        queryClient.invalidateQueries({ queryKey: scheduleVisitsKey(weekStart) })
      }
    },
    [queryClient],
  )

  return { scheduleAll, assignCrew, setVehicle, skipAll, invalidateWeeks }
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
    if (action === 'add') emitTourEvent('schedule.crewAssigned')
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
