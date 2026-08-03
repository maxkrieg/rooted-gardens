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
 * The lookup is deliberately mount-only: re-resolving when `weeks` changes would
 * reopen the sheet after the user closed it, since VisitDetailSheet calls
 * router.refresh() on close.
 */
export function DeepLinkedVisitSheet({ weeks, visitId, role }: DeepLinkedVisitSheetProps) {
  const found = useMemo(
    () => findVisitInWeeks(weeks, visitId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [open, setOpen] = useState(!!found)

  if (!found) return null

  return (
    <VisitDetailSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Clear the param so the URL stops describing a sheet that's closed —
        // otherwise a refresh would reopen it.
        if (!next) syncVisitUrlParam(null)
      }}
      row={found.row}
      weekStart={found.weekStart}
      role={role}
    />
  )
}
