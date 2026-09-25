'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FilePen, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCan } from '@/components/app/RoleProvider'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import { toUserMessage } from '@/lib/errors'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import { RouteGroupBand } from '@/components/management/RouteGroupBand'
import { ScheduleBulkControls } from '@/components/management/ScheduleBulkControls'
import type { BulkTarget } from '@/hooks/useBulkScheduleActions'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { WeekNoteRibbon } from '@/components/management/WeekNoteRibbon'
import { RouteDefaultsSheet } from '@/components/management/RouteDefaultsSheet'
import { RoutePicker } from '@/components/management/RoutePicker'
import { useRouteAllUngrouped } from '@/hooks/useRouteAllUngrouped'
import { useScheduleReference } from '@/hooks/useManagementSchedule'
import { useWeekNotes, useSaveWeekNote } from '@/hooks/useWeekNotes'
import { isVisitInProgress, formatElapsed, displayCrewFor } from '@/lib/utils/visits'
import { groupRowsByAccount, routeGroupStats, sortRowsByPriority } from '@/lib/utils/schedule'
import { usePropertyLastVisit } from '@/hooks/usePropertyLastVisit'
import {
  DEFAULT_SCHEDULE_SORT,
  UNGROUPED_SORT_KEY,
  sortModeForGroup,
  type ScheduleSortMode,
  type ScheduleSortState,
} from '@/lib/utils/schedule-sort'
import { ScheduleSortToggle } from '@/components/management/ScheduleSortToggle'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import {
  VisitStatusIcon,
  visitRowTint,
  CadenceBadge,
  invoiceStatusLabel,
} from '@/components/management/badges'
import type {
  Account,
  Employee,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

interface ScheduleListMobileProps {
  /** The single week on screen, already filtered. */
  week: ScheduleWeek | undefined
  /** The unfiltered 4-week window — only feeds RouteAssignDialog's week picker. */
  windowWeeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  /** True when a filter is narrowing the view — changes the empty state's meaning. */
  filtered?: boolean
  /** Rows become checkboxes and the bulk bar appears. Owned by ScheduleView so
   *  the header's `⋯ → Select` can toggle it. */
  selectMode?: boolean
  onExitSelectMode?: () => void
  /** Schedule-wide default plus per-group overrides. Owned by ScheduleView so
   *  the top-of-page switch and the per-band switches share one state. */
  sortState?: ScheduleSortState
  onGroupSortChange?: (groupKey: string, mode: ScheduleSortMode) => void
}

export function ScheduleListMobile({
  week,
  windowWeeks,
  employees,
  vehicles,
  filtered,
  selectMode = false,
  onExitSelectMode,
  sortState = DEFAULT_SCHEDULE_SORT,
  onGroupSortChange,
}: ScheduleListMobileProps) {
  const { editSchedule: canEdit } = useCan()
  const createVisit = useCreateVisit()

  const { data: lastVisitByProperty } = usePropertyLastVisit()

  // Each band resolves its own mode — its override, else the schedule-wide
  // default. Applied before groupRowsByAccount so a multi-property account still
  // clusters; the cluster just moves to wherever its most urgent property lands.
  const orderRows = useCallback(
    (groupKey: string, rows: SchedulePropertyRow[]) =>
      sortModeForGroup(sortState, groupKey) === 'priority'
        ? sortRowsByPriority(rows, lastVisitByProperty)
        : rows,
    [sortState, lastVisitByProperty],
  )

  // Tick elapsed time every 30s
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<SchedulePropertyRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  // Visits created in this session, keyed by row. Layered *under* the server
  // props in renderStopRow so a just-scheduled row paints immediately instead of
  // waiting on revalidatePath — and never cleared, since clearing it would race
  // the props catching up (the routes-page freeze, commit f4e09e3).
  const [createdVisits, setCreatedVisits] = useState<Map<string, VisitWithCrew>>(new Map())

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroup, setAssignGroup] = useState<RouteGroup | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: weekNotes = [] } = useWeekNotes(week?.weekStart ?? '')
  const { data: reference } = useScheduleReference()
  const [defaultsGroup, setDefaultsGroup] = useState<RouteGroup | null>(null)
  // Which group's note editor is open. Lifted here because the band's ⋯ opens
  // it and the ribbon renders it — there's no permanent "add a note" row.
  const [noteEditGroupId, setNoteEditGroupId] = useState<string | null>(null)
  const routeAllUngrouped = useRouteAllUngrouped()
  const saveWeekNote = useSaveWeekNote()

  // Leaving select mode must drop the selection, or re-entering it resumes with
  // stale property ids that may no longer be on screen. Adjusted during render
  // (React's sanctioned pattern, as in UnroutedPanel) rather than in an effect,
  // which would render the stale selection once before clearing it.
  const [selectModeSnapshot, setSelectModeSnapshot] = useState(selectMode)
  if (selectModeSnapshot !== selectMode) {
    setSelectModeSnapshot(selectMode)
    if (selected.size > 0) setSelected(new Set())
  }

  /**
   * What the route group band summarises. Reads the same merged visit the rows
   * do so the progress bar and the on-site dot can't disagree with the rows.
   */
  function statsFor(rows: SchedulePropertyRow[], weekStart: string) {
    return routeGroupStats(
      rows.map((row) => row.visit ?? createdVisits.get(`${row.property.id}-${weekStart}`) ?? null),
      vehicles,
    )
  }

  function handleSheetOpenChange(next: boolean) {
    setSheetOpen(next)
    if (!next) syncVisitUrlParam(null)
  }

  function openSheet(row: SchedulePropertyRow, visit: VisitWithCrew, weekStart: string) {
    setSheetRow({ ...row, visit })
    setSheetWeek(weekStart)
    setSheetOpen(true)
    // The phone list renders a single week — that IS the window start.
    syncVisitUrlParam(visit.id, weekStart)
  }

  /**
   * Tapping an unscheduled row both schedules it and opens the drawer — one tap
   * instead of two on a phone, where the owner is almost always about to set
   * crew or an instruction. Not wrapped in startTransition: the drawer state
   * must be urgent, or it queues behind the revalidated RSC tree and reads as a
   * frozen row.
   */
  async function scheduleRow(row: SchedulePropertyRow, weekStart: string) {
    const cellKey = `${row.property.id}-${weekStart}`
    setCreatingKey(cellKey)
    try {
      const visit = await createVisit(row, weekStart)
      setCreatedVisits((prev) => new Map(prev).set(cellKey, visit))
      openSheet(row, visit, weekStart)
    } catch (err) {
      // A thrown failure (dropped connection mid-action) never reaches the
      // res.error branch, and would leave the row stuck on its placeholder.
      toast.error('Failed to create visit', {
        description: toUserMessage(err, 'Could not add the stop.', '[ScheduleListMobile.scheduleRow]'),
      })
    } finally {
      setCreatingKey(null)
    }
  }

  function handleRowClick(row: SchedulePropertyRow, visit: VisitWithCrew | null) {
    if (!week) return
    if (visit) {
      openSheet(row, visit, week.weekStart)
    } else {
      void scheduleRow(row, week.weekStart)
    }
  }

  if (!week || (week.routeGroups.length === 0 && week.ungrouped.length === 0)) {
    return <ScheduleEmptyState filtered={filtered} />
  }
  const currentWeek = week

  const allRows = [
    ...currentWeek.routeGroups.flatMap((g) => g.rows),
    ...currentWeek.ungrouped,
  ]
  const selectedTargets: BulkTarget[] = allRows
    .filter((row) => selected.has(row.property.id))
    .map((row) => ({ row, weekStart: currentWeek.weekStart }))

  function toggleSelected(propertyId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }

  // Renders one stop button. Shared by both label shapes so the status/crew/
  // on-site content can never drift between them:
  //   - `merged` — the ~99% case: one account with one property. Account
  //     name, address, and frequency/price all live in this one button.
  //   - `nested` — a property row under a multi-property account header.
  //     Only these carry the sage rail — it means "a site of the account
  //     above," not "this is a property row."
  //
  // Status is a glyph in the left gutter plus a row-wide tint, not a badge: the
  // row used to carry up to five pills (status, frequency, invoice, two crew
  // chips) and the account name was truncating to make room for them. Settled
  // visits recede behind a wash with muted text; an outstanding one keeps the
  // plain paper surface and full-strength ink, which is what makes it the thing
  // your eye lands on.
  function renderStopRow(
    account: Account,
    row: SchedulePropertyRow,
    variant: 'merged' | 'nested',
    showTopBorder: boolean,
  ) {
    const isNested = variant === 'nested'
    const cellKey = `${row.property.id}-${currentWeek.weekStart}`
    const isCreating = creatingKey === cellKey
    // Server data wins once the revalidated render lands; the local map only
    // covers the gap between the insert and that render.
    const base = row.visit ?? createdVisits.get(cellKey) ?? null
    // Layer the live overlay (realtime UPDATEs + the drawer's own writes) over
    // the server row, so status, timing, and the instruction flag all repaint
    // without waiting on a server render.
    const visit = base
    const effectiveStartedAt = visit?.started_at ?? null
    const inProgress = visit ? isVisitInProgress(visit) : false
    // Once a visit is completed, show who actually did the work rather than
    // who was planned — falls back to assigned crew if no completion crew
    // was recorded.
    const displayCrew = visit ? displayCrewFor(visit) : []
    const displayedCrew = displayCrew.slice(0, 2)
    const overflow = displayCrew.length - 2

    const isSelected = selected.has(row.property.id)
    const settled = visit?.status === 'completed' || visit?.status === 'skipped'
    const crewLabel = displayedCrew.map((emp) => emp.name.split(' ')[0]).join(', ')

    return (
      <button
        key={row.property.id}
        type="button"
        disabled={isCreating}
        aria-pressed={selectMode ? isSelected : undefined}
        onClick={() =>
          selectMode ? toggleSelected(row.property.id) : handleRowClick(row, visit)
        }
        className={cn(
          'w-full text-left py-3 min-h-[56px]',
          'flex items-start gap-3',
          isNested ? 'border-l-2 border-l-primary/25 pl-6 pr-4' : 'px-4',
          showTopBorder && 'border-t border-border/50',
          visitRowTint(visit?.status),
          // brightness, not a background — a bg-* hover is the same property as
          // the status tint and would strip the wash off the row on touch.
          'transition-[filter] hover:brightness-[0.97] active:brightness-[0.94]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isCreating && 'opacity-50 cursor-wait',
          // Selection deliberately beats the status wash — in select mode what's
          // ticked matters more than what's done.
          selectMode && isSelected && 'bg-accent/40',
        )}
      >
        {/* The row is the tap target, so this is presentational only — a real
            Checkbox here is a <button> inside a <button>. */}
        {selectMode && <CheckIndicator checked={isSelected} className="mt-0.5" />}

        {/* Identity */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {!isNested && (
            <span
              className={cn(
                'font-display text-[15px] font-semibold leading-snug truncate',
                settled ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {account.name}
            </span>
          )}
          <span className="text-[13px] leading-snug text-muted-foreground truncate">
            {row.property.address}
          </span>
          {/* One meta line carries what used to be pills on the right: cadence,
              who worked it, and where the invoice is. No rate — the schedule is
              a dispatch screen, and pricing is the accountant's question. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {/* Settled work needs no countdown — the row already carries its
                status wash and glyph. Outstanding work is where the wait matters. */}
            <CadenceBadge
              property={row.property}
              lastVisitOn={lastVisitByProperty?.[row.property.id] ?? null}
              showDays={!visit || visit.status === 'scheduled'}
            />
            {crewLabel && (
              <span className="truncate">
                {crewLabel}
                {overflow > 0 && ` +${overflow}`}
              </span>
            )}
            {visit?.status === 'completed' && visit.invoice && (
              <span className="ink-invoiced flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                <Receipt className="h-2.5 w-2.5 shrink-0" aria-hidden />
                {invoiceStatusLabel(visit.invoice.status)}
              </span>
            )}
          </div>
          {/* The spreadsheet's orange cell. It used to be a bare icon on the
              right that said an instruction existed without showing it — on a
              phone there's no hover to reveal it, so it reads here. */}
          {visit?.crew_instruction && (
            <span className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-[var(--clay)]">
              <FilePen className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span className="line-clamp-2">{visit.crew_instruction}</span>
            </span>
          )}
        </div>

        {/* Right: the status mark, the live clock, or the schedule action —
            never more than one. A scheduled stop renders nothing here but its
            screen-reader label; an undecorated row IS the outstanding one. */}
        {visit && inProgress && effectiveStartedAt ? (
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums text-[var(--clay)]">
            <VisitStatusIcon status={visit.status} inProgress />
            {formatElapsed(effectiveStartedAt)}
          </span>
        ) : !visit ? (
          <span className="mt-0.5 shrink-0 text-xs font-medium text-primary">
            {isCreating ? '…' : '+ Schedule'}
          </span>
        ) : (
          <span className="mt-0.5 flex shrink-0">
            <VisitStatusIcon status={visit.status} />
          </span>
        )}
      </button>
    )
  }

  // Multi-property account header — its own row above the nested, railed
  // property rows. ~99% of accounts skip this entirely (see renderStopRow's
  // `merged` variant).
  function AccountHeaderRow({
    account,
    propertyCount,
    showTopBorder,
  }: {
    account: Account
    propertyCount: number
    showTopBorder: boolean
  }) {
    return (
      <div className={cn('px-4 pt-2.5 pb-1.5', showTopBorder && 'border-t border-border/60')}>
        <div className="font-display text-[15px] font-semibold leading-snug text-foreground truncate">
          {account.name}
        </div>
        {/* The rate used to sit opposite this; with it gone the count reads
            left, under the name, rather than floating against nothing. */}
        <div className="mt-0.5 text-[11px] text-muted-foreground">{propertyCount} sites</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {currentWeek.routeGroups.map(({ routeGroup, rows }) => (
          <div
            key={routeGroup.id}
            /* Full-bleed on a phone (ScheduleView cancels the page padding), so
               there are no side edges to round or shadow — just hairlines. */
            className="border-y border-border bg-card"
          >
            {/* Sticky under the compact header, whose height it reads from
                --schedule-sticky-h. Knowing which route you're scrolling
                through is most of what the sheet's frozen rows gave him.
                The card can't clip its overflow or this stops sticking. */}
            <div className="sticky z-10" style={{ top: 'var(--schedule-sticky-h, 0px)' }}>
              <RouteGroupBand
                name={routeGroup.name}
                sortSlot={
                  onGroupSortChange && (
                    <ScheduleSortToggle
                      size="compact"
                      scope={routeGroup.name}
                      mode={sortModeForGroup(sortState, routeGroup.id)}
                      onChange={(mode) => onGroupSortChange(routeGroup.id, mode)}
                    />
                  )
                }
                days={routeGroup.default_days ?? []}
                stats={statsFor(rows, currentWeek.weekStart)}
                canEdit={canEdit}
                onAssignRoute={() => {
                  setAssignGroup(routeGroup)
                  setAssignOpen(true)
                }}
                onEditDefaults={() => setDefaultsGroup(routeGroup)}
                onEditNote={() => setNoteEditGroupId(routeGroup.id)}
                hasNote={weekNotes.some((n) => n.route_group_id === routeGroup.id)}
                noteSlot={
                  <WeekNoteRibbon
                    note={
                      weekNotes.find((n) => n.route_group_id === routeGroup.id)?.note ?? null
                    }
                    canEdit={canEdit}
                    editing={noteEditGroupId === routeGroup.id}
                    onEditingChange={(open) =>
                      setNoteEditGroupId(open ? routeGroup.id : null)
                    }
                    onSave={(note) => saveWeekNote(currentWeek.weekStart, routeGroup.id, note)}
                  />
                }
              />
            </div>

            {/* Properties, nested by account */}
            <div className="overflow-hidden">
              {groupRowsByAccount(orderRows(routeGroup.id, rows)).map(({ account, rows: acctRows }, acctIdx) => {
                if (acctRows.length === 1) {
                  return renderStopRow(account, acctRows[0], 'merged', acctIdx > 0)
                }
                return (
                  <div key={account.id}>
                    <AccountHeaderRow account={account} propertyCount={acctRows.length} showTopBorder={acctIdx > 0} />
                    {acctRows.map((row, rowIdx) => renderStopRow(account, row, 'nested', rowIdx > 0))}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {currentWeek.ungrouped.length > 0 && (
          <div className="overflow-hidden border-y border-[var(--clay)]/30 bg-card">
            {/* "Not on a route" — properties with no property_route_groups row.
                These used to be silently dropped from the schedule entirely. */}
            <div className="bg-[var(--clay)]/10 text-[var(--clay)] flex items-center justify-between px-4 py-2.5 border-b border-[var(--clay)]/30">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-semibold uppercase tracking-widest">
                  Not on a route · {currentWeek.ungrouped.length}
                </span>
                {onGroupSortChange && (
                  <ScheduleSortToggle
                    size="compact"
                    scope="Stops with no route"
                    mode={sortModeForGroup(sortState, UNGROUPED_SORT_KEY)}
                    onChange={(mode) => onGroupSortChange(UNGROUPED_SORT_KEY, mode)}
                  />
                )}
              </span>
              {/* Was a link to /app/routes carrying no context — you arrived at
                  a list of every route with no memory of which stop sent you. */}
              {canEdit && (
                <RoutePicker
                  routeGroups={reference?.routeGroups ?? []}
                  label={`Route all ${currentWeek.ungrouped.length}`}
                  className="h-8 border-[var(--clay)]/40 text-[var(--clay)]"
                  onSelect={(routeGroupId) =>
                    void routeAllUngrouped(currentWeek.ungrouped, routeGroupId)
                  }
                />
              )}
            </div>
            <div>
              {groupRowsByAccount(orderRows(UNGROUPED_SORT_KEY, currentWeek.ungrouped)).map(({ account, rows: acctRows }, acctIdx) => {
                if (acctRows.length === 1) {
                  return renderStopRow(account, acctRows[0], 'merged', acctIdx > 0)
                }
                return (
                  <div key={account.id}>
                    <AccountHeaderRow account={account} propertyCount={acctRows.length} showTopBorder={acctIdx > 0} />
                    {acctRows.map((row, rowIdx) => renderStopRow(account, row, 'nested', rowIdx > 0))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectMode && (
        <ScheduleBulkControls
          targets={selectedTargets}
          selectableCount={allRows.length}
          onSelectAll={() => setSelected(new Set(allRows.map((r) => r.property.id)))}
          onClearSelection={() => setSelected(new Set())}
          onExitSelectMode={onExitSelectMode}
          employees={employees}
          vehicles={vehicles}
        />
      )}

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          row={sheetRow}
          weekStart={sheetWeek}
        />
      )}

      {defaultsGroup && (
        <RouteDefaultsSheet
          open
          onOpenChange={(open) => !open && setDefaultsGroup(null)}
          routeGroup={defaultsGroup}
          employees={employees}
          vehicles={vehicles}
          currentCrewIds={(reference?.defaultCrew ?? [])
            .filter((c) => c.route_group_id === defaultsGroup.id)
            .map((c) => c.employee_id)}
        />
      )}

      {assignGroup && (
        <RouteAssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          routeGroup={assignGroup}
          weeks={windowWeeks}
          employees={employees}
          vehicles={vehicles}
        />
      )}
    </>
  )
}
