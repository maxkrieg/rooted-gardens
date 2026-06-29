'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getWeekStart } from '@/lib/utils/schedule'

/**
 * Opens two Supabase Realtime channels for the duration of the crew session:
 *
 * 1. `visit_crew` filtered to the current employee's `assigned` rows — fires
 *    when any actor (owner from the management grid, or a fellow crew member
 *    from the Schedule page) adds or removes this crew member from a visit.
 *
 * 2. `visits` filtered to the current week — fires on new stops and crew-
 *    instruction edits so the schedule view stays fresh without a manual refresh.
 *
 * Invalidates React Query caches on each event. The toast for assignment changes
 * is debounced (one per 3 s window) to avoid flooding when a bulk route-assign
 * fires many INSERT events at once.
 *
 * Called from the crew layout so it's always active regardless of which tab is open.
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
          if (relation !== 'assigned') return

          queryClient.invalidateQueries({ queryKey: ['crew-today-stops', employeeId] })
          queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })

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
          queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
          queryClient.invalidateQueries({ queryKey: ['crew-today-stops', employeeId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(assignmentChannel)
      supabase.removeChannel(visitsChannel)
    }
  }, [employeeId, weekStartISO, queryClient])
}
