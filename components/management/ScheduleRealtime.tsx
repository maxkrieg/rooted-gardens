'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useApplyVisitUpdate } from '@/hooks/useManagementSchedule'
import type { VisitOverlay } from '@/lib/utils/visits'

// One refetch for an assignRouteCrew's burst of visit_crew rows, not one per row.
const CREW_REFETCH_DEBOUNCE_MS = 500

/**
 * Live `visits` updates (e.g. crew starting the on-site clock elsewhere), written into the
 * query cache via the version-guarded applyVisitUpdate, plus `visit_crew` changes made on
 * another device, which carry no visit row and so refetch instead. Renders nothing.
 */
export function ScheduleRealtime({ visitIds }: { visitIds: string[] }) {
  const applyVisitUpdate = useApplyVisitUpdate()
  const queryClient = useQueryClient()

  // Join to a stable string so the effect dep is a primitive, not an array
  // reference that changes identity on every render.
  const visitIdsKey = visitIds.join(',')

  useEffect(() => {
    if (!visitIdsKey) return

    const supabase = createClient()
    const ids = new Set(visitIdsKey.split(','))
    let crewRefetch: ReturnType<typeof setTimeout> | undefined

    const channel = supabase
      .channel('management_visits_overlay')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits' },
        (payload) => {
          // payload.new is the whole row under the default replica identity, so
          // status, crew_instruction and timing all ride along for free.
          const visit = payload.new as VisitOverlay
          if (!ids.has(visit.id)) return
          applyVisitUpdate(visit)
        },
      )
      .subscribe()

    const crewChannel = supabase
      .channel('management_visit_crew')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visit_crew' },
        (payload) => {
          // DELETE carries only the primary key, which includes visit_id.
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as {
            visit_id?: string
          }
          if (!row.visit_id || !ids.has(row.visit_id)) return
          clearTimeout(crewRefetch)
          crewRefetch = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
          }, CREW_REFETCH_DEBOUNCE_MS)
        },
      )
      .subscribe()

    return () => {
      clearTimeout(crewRefetch)
      supabase.removeChannel(channel)
      supabase.removeChannel(crewChannel)
    }
  }, [visitIdsKey, applyVisitUpdate, queryClient])

  return null
}
