'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCan } from '@/components/app/RoleProvider'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import { useScheduleReference } from '@/hooks/useManagementSchedule'
import { usePropertyLastVisit } from '@/hooks/usePropertyLastVisit'
import { useRouteAllUngrouped } from '@/hooks/useRouteAllUngrouped'
import { useSaveWeekNote } from '@/hooks/useWeekNotes'
import { toUserMessage } from '@/lib/errors'
import { sortRowsByPriority } from '@/lib/utils/schedule'
import { sortModeForGroup, type ScheduleSortState } from '@/lib/utils/schedule-sort'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import type { RouteGroup, SchedulePropertyRow, VisitWithCrew } from '@/types/app'

/** State and handlers shared by the desktop grid and the phone list. */
export function useScheduleInteractions({
  selectMode,
  sortState,
  windowStart,
}: {
  selectMode: boolean
  sortState: ScheduleSortState
  /** First week the server built, for the `?visit=` deep link. */
  windowStart: string | undefined
}) {
  const { editSchedule: canEdit } = useCan()
  const createVisit = useCreateVisit()
  const { data: lastVisitByProperty } = usePropertyLastVisit()
  const { data: reference } = useScheduleReference()
  const routeAllUngrouped = useRouteAllUngrouped()
  const saveWeekNote = useSaveWeekNote()

  // Applied before groupRowsByAccount so a multi-property account still clusters.
  const orderRows = useCallback(
    (groupKey: string, rows: SchedulePropertyRow[]) =>
      sortModeForGroup(sortState, groupKey) === 'priority'
        ? sortRowsByPriority(rows, lastVisitByProperty)
        : rows,
    [sortState, lastVisitByProperty],
  )

  // One 30s timer re-renders elapsed times, not one per row.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<SchedulePropertyRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  // Just-created visits, keyed `${propertyId}-${weekStart}`, layered under server data so a
  // new stop paints immediately. Never cleared: clearing races the data catching up.
  const [createdVisits, setCreatedVisits] = useState<Map<string, VisitWithCrew>>(new Map())
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroup, setAssignGroup] = useState<RouteGroup | null>(null)
  const [defaultsGroup, setDefaultsGroup] = useState<RouteGroup | null>(null)
  const [noteEditKey, setNoteEditKey] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Leaving select mode drops the selection. Adjusted during render, not in an effect,
  // so the stale selection never paints.
  const [selectModeSnapshot, setSelectModeSnapshot] = useState(selectMode)
  if (selectModeSnapshot !== selectMode) {
    setSelectModeSnapshot(selectMode)
    if (selected.size > 0) setSelected(new Set())
  }

  function openSheet(row: SchedulePropertyRow, visit: VisitWithCrew, weekStart: string) {
    setSheetRow({ ...row, visit })
    setSheetWeek(weekStart)
    setSheetOpen(true)
    syncVisitUrlParam(visit.id, windowStart ?? weekStart)
  }

  function handleSheetOpenChange(next: boolean) {
    setSheetOpen(next)
    if (!next) syncVisitUrlParam(null)
  }

  function openAssign(group: RouteGroup) {
    setAssignGroup(group)
    setAssignOpen(true)
  }

  // Not in startTransition: the drawer opening must be urgent or the row reads as frozen.
  async function scheduleVisit(
    row: SchedulePropertyRow,
    weekStart: string,
    { openDrawer }: { openDrawer: boolean },
  ) {
    const key = `${row.property.id}-${weekStart}`
    setCreatingKey(key)
    try {
      const visit = await createVisit(row, weekStart)
      setCreatedVisits((prev) => new Map(prev).set(key, visit))
      if (openDrawer) openSheet(row, visit, weekStart)
    } catch (err) {
      toast.error('Failed to create visit', {
        description: toUserMessage(err, 'Could not add the stop.', '[schedule.scheduleVisit]'),
      })
    } finally {
      setCreatingKey(null)
    }
  }

  return {
    canEdit,
    lastVisitByProperty,
    reference,
    routeAllUngrouped,
    saveWeekNote,
    orderRows,
    sheetOpen,
    sheetRow,
    sheetWeek,
    openSheet,
    handleSheetOpenChange,
    creatingKey,
    createdVisits,
    scheduleVisit,
    assignOpen,
    setAssignOpen,
    assignGroup,
    openAssign,
    defaultsGroup,
    setDefaultsGroup,
    noteEditKey,
    setNoteEditKey,
    selected,
    setSelected,
  }
}
