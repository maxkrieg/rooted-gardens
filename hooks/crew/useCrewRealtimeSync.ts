'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getWeekStart } from '@/lib/utils/schedule'

/**
 * Two Realtime channels for the signed-in user: their own visit_crew assignments (toast,
 * debounced 3s for bulk assigns) and the current week's visits (new stops, instruction edits).
 * Mounted by AppShell.
 */
export function useCrewRealtimeSync(employeeId: string | undefined) {
  const queryClient = useQueryClient()
  const lastToastAt = useRef<number>(0)

  const weekStartISO = format(getWeekStart(new Date()), 'yyyy-MM-dd')

  useEffect(() => {
    if (!employeeId) return

    const supabase = createClient()

    // Channel 1 — assignment changes for this crew member
    const assignmentChannel = supabase
      .channel('crew_assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visit_crew',
          filter: `employee_id=eq.${employeeId}`,
        },
        (payload) => {
          const relation =
            (payload.new as { relation?: string })?.relation ??
            (payload.old as { relation?: string })?.relation

          // Refresh on either relation — "My stops" matches assigned OR
          // completed, so a completion row changes what this person should see.
          queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })

          // ...but only an assignment is a schedule change worth announcing; a
          // completion row is usually their own logging coming back around.
          if (relation !== 'assigned') return

          // Debounce toast — show at most once per 3 s to handle bulk assignments
          const now = Date.now()
          if (now - lastToastAt.current > 3_000) {
            lastToastAt.current = now
            toast('Your schedule was updated.')
          }
        }
      )
      .subscribe()

    // Channel 2 — visit content changes for the current week
    const visitsChannel = supabase
      .channel('crew_visits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `week_start=eq.${weekStartISO}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
          // Also refresh any open stop detail (e.g. another crew member's Start
          // or Discard) — prefix match so it catches whichever visitId is open.
          queryClient.invalidateQueries({ queryKey: ['stop-detail'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(assignmentChannel)
      supabase.removeChannel(visitsChannel)
    }
  }, [employeeId, weekStartISO, queryClient])
}
