'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { discardMutation, enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { QueueRejectedError } from '@/lib/errors'
import { scheduleVisitsKey } from '@/hooks/useManagementSchedule'
import type { SchedulePropertyRow, VisitWithCrew } from '@/types/app'

/**
 * Schedule a property for a week via the offline queue. The id is minted on the device, so the
 * drawer can open offline and a replay upserts instead of duplicating.
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

      const mutationId = await enqueueMutation(
        'create_visit',
        {
          id: visit.id,
          accountId: row.account.id,
          propertyId: row.property.id,
          weekStart,
        },
        label ?? row.property.address,
      )
      const { rejected } = await flushMutationQueue()

      // Refused on its first try (RLS): it never will save, so take the row back off the
      // screen and out of "Changes that didn't save" — the caller's toast says why.
      const refusal = rejected.find((r) => r.id === mutationId)
      if (refusal) {
        queryClient.setQueryData<VisitWithCrew[]>(scheduleVisitsKey(weekStart), (old) =>
          old?.filter((v) => v.id !== visit.id),
        )
        await discardMutation(mutationId)
        throw new QueueRejectedError(refusal.error)
      }

      return visit
    },
    [queryClient],
  )
}
