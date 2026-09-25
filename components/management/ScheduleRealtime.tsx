'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApplyVisitUpdate } from '@/hooks/useManagementSchedule'
import type { VisitOverlay } from '@/lib/utils/visits'

/**
 * Live `visits` updates (e.g. crew starting the on-site clock elsewhere), written into the
 * query cache via the version-guarded applyVisitUpdate. Renders nothing.
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
