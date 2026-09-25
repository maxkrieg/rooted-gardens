'use client'

import { useMemo, useState } from 'react'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { findVisitInWeeks } from '@/lib/utils/schedule'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import type { ScheduleWeek } from '@/types/app'

interface DeepLinkedVisitSheetProps {
  /** The unfiltered window, so the link still resolves if a filter would have
   *  hidden the row. */
  weeks: ScheduleWeek[]
  /** The `?visit=` param — usually absent, in which case this renders nothing. */
  visitId: string | undefined
}

/**
 * Opens the sheet for a `?visit=` deep link. Lives here because the grid and phone list are
 * both always mounted (CSS-hidden), and each opening it stacked two sheets. Latches on the first
 * render where the visit is found, so closing it sticks.
 */
export function DeepLinkedVisitSheet({ weeks, visitId }: DeepLinkedVisitSheetProps) {
  // Derived, not latched at mount: `weeks` is empty on the first render now that
  // the schedule is client-fetched, so the visit only becomes findable later.
  const found = useMemo(() => findVisitInWeeks(weeks, visitId), [weeks, visitId])
  // Closing is one-way — this is never set back to false, which is what stops a
  // later `weeks` change from reopening a sheet the user dismissed.
  const [closed, setClosed] = useState(false)

  if (!found) return null

  return (
    <VisitDetailSheet
      open={!closed}
      onOpenChange={(next) => {
        if (next) return
        setClosed(true)
        // Clear the param so the URL stops describing a sheet that's closed —
        // otherwise a refresh would reopen it.
        syncVisitUrlParam(null)
      }}
      row={found.row}
      weekStart={found.weekStart}
    />
  )
}
