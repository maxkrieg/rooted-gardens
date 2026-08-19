'use client'

import { useMemo, useState } from 'react'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { findVisitInWeeks } from '@/lib/utils/schedule'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import type { EmployeeRole, ScheduleWeek } from '@/types/app'

interface DeepLinkedVisitSheetProps {
  /** The unfiltered window, so the link still resolves if a filter would have
   *  hidden the row. */
  weeks: ScheduleWeek[]
  /** The `?visit=` param — usually absent, in which case this renders nothing. */
  visitId: string | undefined
  role: EmployeeRole | undefined
}

/**
 * Opens a visit's detail sheet on arrival from a `?visit=<id>` deep link (the
 * crew stop page's "Manager view" button).
 *
 * Owned here rather than by the grid or the phone list because **both of those
 * are always mounted** — `hidden lg:block` / `lg:hidden` only hides their
 * containers, and a Sheet portals to `document.body` regardless. Letting each
 * one honor the deep link opened two identical sheets stacked on top of each
 * other, with the two overlays compounding into a near-black scrim.
 *
 * Resolves once, on the first render where the visit is actually findable, then
 * latches. It used to resolve at mount, which stopped working when the schedule
 * became client-fetched and `weeks` arrived empty on the first render. The latch
 * is what keeps a later `weeks` change from reopening a sheet the user closed.
 */
export function DeepLinkedVisitSheet({ weeks, visitId, role }: DeepLinkedVisitSheetProps) {
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
      role={role}
    />
  )
}
