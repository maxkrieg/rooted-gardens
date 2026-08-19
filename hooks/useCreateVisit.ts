'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import type { SchedulePropertyRow, VisitWithCrew } from '@/types/app'

/**
 * Schedule a property for a week through the offline queue.
 *
 * The id is minted here rather than by the database: single-click scheduling
 * opens the drawer on the new visit, and offline there is no round-trip to
 * return one. It also makes a queue replay upsert instead of duplicating.
 */
export function useCreateVisit() {
  const queryClient = useQueryClient()

  return useCallback(
    async (row: SchedulePropertyRow, weekStart: string, label?: string): Promise<VisitWithCrew> => {
      const now = new Date().toISOString()
      const visit = {
        id: crypto.randomUUID(),
        account_id: row.account.id,
        property_id: row.property.id,
        week_start: weekStart,
        status: 'scheduled',
        crew_instruction: null,
        vehicle_id: null,
        started_at: null,
        ended_at: null,
        service_types: null,
        completion_note: null,
        skip_reason: null,
        invoice_id: null,
        created_at: now,
        updated_at: now,
        // Joins the server would have returned. visit_crew must be an array —
        // VisitDetailSheet's normalizeRow walks it unguarded.
        visit_crew: [],
        invoice: null,
        photo_count: 0,
      } as unknown as VisitWithCrew

      queryClient.setQueryData<VisitWithCrew[]>(scheduleVisitsKey(weekStart), (old) =>
        old ? [...old, visit] : [visit],
      )

      await enqueueMutation(
        'create_visit',
        {
          id: visit.id,
          accountId: row.account.id,
          propertyId: row.property.id,
          weekStart,
        },
        label ?? row.property.address,
      )
      await flushMutationQueue()

      return visit
    },
    [queryClient],
  )
}
