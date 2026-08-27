'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWeekNotes } from '@/lib/schedule/fetch'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import type { RouteGroupWeekNote } from '@/types/app'

export const weekNotesKey = (weekStartISO: string) => ['schedule-week-notes', weekStartISO]

/**
 * The dispatch notes for every route group in one week.
 *
 * A separate query from the visits, not an embed: the notes change on a
 * completely different rhythm (once on Sunday, by one person) and this keeps a
 * note edit from invalidating the whole week's visits.
 */
export function useWeekNotes(weekStartISO: string) {
  return useQuery({
    queryKey: weekNotesKey(weekStartISO),
    queryFn: () => fetchWeekNotes(weekStartISO),
    staleTime: 60_000,
  })
}

/**
 * Save (or clear) one route group's note for a week, through the offline queue —
 * this is written from the same truck as everything else on the schedule.
 */
export function useSaveWeekNote(weekStartISO: string) {
  const queryClient = useQueryClient()

  return useCallback(
    async (routeGroupId: string, note: string) => {
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
    [queryClient, weekStartISO],
  )
}
