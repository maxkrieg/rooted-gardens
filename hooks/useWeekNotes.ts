'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWeekNotes } from '@/lib/schedule/fetch'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import type { RouteGroupWeekNote } from '@/types/app'

const weekNotesKey = (weekStartISO: string) => ['schedule-week-notes', weekStartISO]

/** One week's dispatch notes, separate from visits so a note edit doesn't invalidate them. */
export function useWeekNotes(weekStartISO: string) {
  return useQuery({
    queryKey: weekNotesKey(weekStartISO),
    queryFn: () => fetchWeekNotes(weekStartISO),
    staleTime: 60_000,
  })
}

/** Save or clear a route's week note via the offline queue. */
export function useSaveWeekNote() {
  const queryClient = useQueryClient()

  return useCallback(
    async (weekStartISO: string, routeGroupId: string, note: string) => {
      const trimmed = note.trim()

      // Optimistic, because the band renders straight from this cache and
      // offline there is no server round-trip coming to correct it.
      queryClient.setQueryData<RouteGroupWeekNote[]>(weekNotesKey(weekStartISO), (old) => {
        const rest = (old ?? []).filter((n) => n.route_group_id !== routeGroupId)
        if (trimmed.length === 0) return rest
        const existing = (old ?? []).find((n) => n.route_group_id === routeGroupId)
        const now = new Date().toISOString()
        return [
          ...rest,
          {
            ...(existing ?? {
              id: crypto.randomUUID(),
              route_group_id: routeGroupId,
              week_start: weekStartISO,
              created_at: now,
            }),
            note: trimmed,
            updated_at: now,
          } as RouteGroupWeekNote,
        ]
      })

      await enqueueMutation('route_week_note', {
        routeGroupId,
        weekStart: weekStartISO,
        note: trimmed,
      })
      await flushMutationQueue()
    },
    [queryClient],
  )
}
