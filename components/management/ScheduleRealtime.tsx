'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApplyVisitUpdate } from '@/hooks/useManagementSchedule'
import type { VisitOverlay } from '@/lib/utils/visits'

/**
 * Live `visits` updates for the schedule on screen.
 *
 * Covers changes made anywhere — most importantly crew completing a stop or
 * starting the on-site clock on another device, which is what the terracotta
 * "On site" indicator reads.
 *
 * Was `SessionsProvider`, which kept its own `Map<visitId, VisitOverlay>` and
 * made every consumer merge it over the query data. That map existed because
 * the grid used to read server props; it reads the React Query cache now, so
 * the third store bought nothing but a merge each consumer could forget. Events
 * are written into the cache directly, version-guarded (see `applyVisitUpdate`).
 *
 * Renders nothing. It takes no children so it can't accidentally become a
 * context boundary again.
 */
export function ScheduleRealtime({ visitIds }: { visitIds: string[] }) {
  const applyVisitUpdate = useApplyVisitUpdate()

  // Join to a stable string so the effect dep is a primitive, not an array
  // reference that changes identity on every render.
  const visitIdsKey = visitIds.join(',')

  useEffect(() => {
    if (!visitIdsKey) return

    const supabase = createClient()
    const ids = new Set(visitIdsKey.split(','))

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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitIdsKey, applyVisitUpdate])

  return null
}
