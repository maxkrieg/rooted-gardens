'use client'

import { useMemo } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Camera, FilePen, Flag, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getWeekStart, groupRowsByAccount, routeGroupStats } from '@/lib/utils/schedule'
import {
  DEFAULT_SCHEDULE_SORT,
  UNGROUPED_SORT_KEY,
  sortModeForGroup,
  type ScheduleSortMode,
  type ScheduleSortState,
} from '@/lib/utils/schedule-sort'
import { ScheduleSortToggle } from '@/components/management/ScheduleSortToggle'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { RouteDefaultsSheet } from '@/components/management/RouteDefaultsSheet'
import { RoutePicker } from '@/components/management/RoutePicker'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import { ScheduleBulkControls } from '@/components/management/ScheduleBulkControls'
import { WeekNoteRibbon } from '@/components/management/WeekNoteRibbon'
import {
  OnSiteDot,
  RouteCrewTruck,
  RouteGroupMenu,
  RouteProgressBar,
  formatDays,
} from '@/components/management/RouteGroupBand'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { useScheduleInteractions } from '@/hooks/useScheduleInteractions'
import { useWeekNotesForWeeks } from '@/hooks/useWeekNotes'
import type { BulkTarget } from '@/hooks/useBulkScheduleActions'
import { isVisitInProgress, formatElapsed, displayCrewFor } from '@/lib/utils/visits'
import {
  CadenceBadge,
  VisitStatusIcon,
  invoiceStatusLabel,
  visitRowTint,
} from '@/components/management/badges'
import type {
  Account,
  Employee,
  Property,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'
import { firstName } from '@/lib/utils/team'

// Shared width for the sticky label column — kept in one place so the header
// `<th>`, the label cells, and the route header cells can never drift apart.
const LABEL_COL_WIDTH = 'w-[260px] min-w-[260px]'

/** Selection key for one property×week cell. */
const cellKey = (propertyId: string, weekStart: string) => `${propertyId}|${weekStart}`

interface ScheduleGridProps {
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  /** True when a filter is narrowing the view — changes the empty state's meaning. */
  filtered?: boolean
  /** Cells become checkboxes and the bulk bar appears. Owned by ScheduleView. */
  selectMode?: boolean
  onExitSelectMode?: () => void
  /** Shared with the phone list so the two schedule views can't disagree. */
  sortState?: ScheduleSortState
  onGroupSortChange?: (groupKey: string, mode: ScheduleSortMode) => void
}

export function ScheduleGrid({
  weeks,
  employees,
  vehicles,
  filtered,
  selectMode = false,
  onExitSelectMode,
  sortState = DEFAULT_SCHEDULE_SORT,
  onGroupSortChange,
}: ScheduleGridProps) {
  const {
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
  } = useScheduleInteractions({ selectMode, sortState, windowStart: weeks[0]?.weekStart })

  const currentWeekStart = useMemo(
    () => format(getWeekStart(new Date()), 'yyyy-MM-dd'),
    []
  )
  const weekStarts = useMemo(() => weeks.map((w) => w.weekStart), [weeks])
  const notesByWeek = useWeekNotesForWeeks(weekStarts)

  // Build visit lookup: property_id → week_start → visit
  const visitMap = useMemo(() => {
    const map = new Map<string, Map<string, VisitWithCrew>>()
    for (const week of weeks) {
      for (const { rows } of week.routeGroups) {
        for (const row of rows) {
          if (!map.has(row.property.id)) map.set(row.property.id, new Map())
          if (row.visit) map.get(row.property.id)!.set(week.weekStart, row.visit)
        }
      }
      for (const row of week.ungrouped) {
        if (!map.has(row.property.id)) map.set(row.property.id, new Map())
        if (row.visit) map.get(row.property.id)!.set(week.weekStart, row.visit)
      }
    }
    return map
  }, [weeks])

  /** The visit for one cell. Server data wins once it lands; the local map only
   *  covers the gap between the insert and that data. */
  function visitFor(row: SchedulePropertyRow, weekStart: string): VisitWithCrew | null {
    return (
      visitMap.get(row.property.id)?.get(weekStart) ??
      createdVisits.get(`${row.property.id}-${weekStart}`) ??
      null
    )
  }

  // `S` schedules without opening the drawer — a fast path for filling a week.
  function toggleCells(keys: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = keys.every((k) => next.has(k))
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  function handleCellClick(row: SchedulePropertyRow, weekStart: string, visit: VisitWithCrew | null) {
    if (selectMode) {
      toggleCells([cellKey(row.property.id, weekStart)])
    } else if (visit) {
      openSheet(row, visit, weekStart)
    } else {
      void scheduleVisit(row, weekStart, { openDrawer: true })
    }
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    row: SchedulePropertyRow,
    weekStart: string,
    visit: VisitWithCrew | null,
  ) {
    // Schedule without opening the drawer — the fast path for filling several
    // cells in a row. Off while selecting, where a keypress shouldn't write.
    if ((e.key === 's' || e.key === 'S') && !visit && !selectMode) {
      e.preventDefault()
      void scheduleVisit(row, weekStart, { openDrawer: false })
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCellClick(row, weekStart, visit)
    }
  }

  function renderWeekCell(row: SchedulePropertyRow, week: ScheduleWeek) {
    const visit = visitFor(row, week.weekStart)
    // week.weekStart and currentWeekStart are both 'yyyy-MM-dd', so this sorts lexicographically.
    const isPastWeek = week.weekStart < currentWeekStart
    return (
      <td
        key={week.weekStart}
        // Only cells with a visit: clicking an empty one creates it.
        data-tour={visit ? 'schedule.stop' : undefined}
        className={cn('px-1.5 py-1.5 align-top', isPastWeek && 'bg-foreground/[0.04]')}
      >
        <ScheduleCell
          visit={visit}
          isCreating={creatingKey === `${row.property.id}-${week.weekStart}`}
          selectMode={selectMode}
          isSelected={selected.has(cellKey(row.property.id, week.weekStart))}
          onClick={() => handleCellClick(row, week.weekStart, visit)}
          onKeyDown={(e) => handleCellKeyDown(e, row, week.weekStart, visit)}
        />
      </td>
    )
  }

  // Renders one account's rows within either a route group or the ungrouped
  // bucket — shared so "Not on a route" gets the same account clustering.
  function renderPropertyRows(keyPrefix: string, account: Account, acctRows: SchedulePropertyRow[]) {
    if (acctRows.length === 1) {
      const row = acctRows[0]
      return [
        <tr
          key={`${keyPrefix}-${row.property.id}`}
          className="group border-b border-border/50 hover:bg-accent/20 transition-colors"
        >
          <PropertyLabelCell
            account={account}
            property={row.property}
            variant="merged"
            lastVisitOn={lastVisitByProperty?.[row.property.id] ?? null}
          />
          {weeks.map((week) => renderWeekCell(row, week))}
        </tr>,
      ]
    }

    return [
      <tr key={`${keyPrefix}-acct-${account.id}`} className="border-b border-border/50">
        <AccountHeaderLabelCell account={account} propertyCount={acctRows.length} />
        <td colSpan={weeks.length} className="bg-card" />
      </tr>,
      ...acctRows.map((row) => (
        <tr
          key={`${keyPrefix}-${row.property.id}`}
          className="group border-b border-border/50 hover:bg-accent/20 transition-colors"
        >
          <PropertyLabelCell
            account={account}
            property={row.property}
            variant="nested"
            lastVisitOn={lastVisitByProperty?.[row.property.id] ?? null}
          />
          {weeks.map((week) => renderWeekCell(row, week))}
        </tr>
      )),
    ]
  }

  /** A route's header for one week. In select mode it toggles every cell of that route-week. */
  function renderRouteWeekCell(routeGroup: RouteGroup, rows: SchedulePropertyRow[], week: ScheduleWeek) {
    const stats = routeGroupStats(
      rows.map((row) => visitFor(row, week.weekStart)),
      vehicles,
    )
    const note =
      notesByWeek.get(week.weekStart)?.find((n) => n.route_group_id === routeGroup.id)?.note ?? null
    const editKey = `${routeGroup.id}|${week.weekStart}`
    const editing = noteEditKey === editKey
    const keys = rows.map((row) => cellKey(row.property.id, week.weekStart))
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k))

    const isCurrent = week.weekStart === currentWeekStart
    const complete = stats.total > 0 && stats.done === stats.total

    // The count is the cell's anchor — Fraunces numerals, like the dashboard's
    // stat figures — and takes the column's green when it's this week.
    const summary = (
      <>
        {selectMode && <CheckIndicator checked={allSelected} />}
        <span
          className="flex shrink-0 items-baseline tabular-nums"
          aria-label={`${stats.done} of ${stats.total} stops done`}
        >
          <span
            className={cn(
              'font-display text-[15px] font-semibold leading-none',
              isCurrent || complete ? 'text-primary' : 'text-foreground',
            )}
          >
            {stats.done}
          </span>
          <span className="ml-0.5 text-[11px] font-medium text-accent-foreground/70">/{stats.total}</span>
        </span>
        {stats.onSite && <OnSiteDot />}
        <span className="flex min-w-0 items-center gap-2 text-accent-foreground/80">
          <RouteCrewTruck crew={stats.crew} vehicles={stats.vehicles} />
        </span>
      </>
    )
    const summaryClass =
      'flex min-h-11 w-full min-w-0 items-center gap-2.5 px-3 py-2 text-[11px]'

    return (
      <td
        key={week.weekStart}
        className="group/rw relative bg-accent align-middle border-t border-t-primary/20 p-0"
      >
        {/* pb clears the progress bar, which is pinned to the cell's bottom
            edge so it runs level across all four columns. */}
        <div className="flex flex-col pb-[3px]">
          <div className="flex items-center">
            {selectMode ? (
              <button
                type="button"
                aria-pressed={allSelected}
                aria-label={`Select every stop on ${routeGroup.name} this week`}
                onClick={() => toggleCells(keys)}
                className={cn(summaryClass, 'text-left hover:bg-primary/10')}
              >
                {summary}
              </button>
            ) : (
              <div className={summaryClass}>{summary}</div>
            )}
            {/* The "add a note" entry has to name a week, so it lives on the
                column rather than in the route's ⋯. */}
            {canEdit && !note && !editing && !selectMode && (
              <button
                type="button"
                onClick={() => setNoteEditKey(editKey)}
                aria-label={`Add a note for ${routeGroup.name}, week of ${format(parseISO(week.weekStart), 'MMM d')}`}
                title="Add a note for this week"
                className="mr-1.5 grid h-7 w-7 shrink-0 place-content-center rounded-md text-accent-foreground/70 opacity-0 transition-opacity hover:bg-primary/10 hover:text-accent-foreground focus-visible:opacity-100 group-hover/rw:opacity-100"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <WeekNoteRibbon
            note={note}
            canEdit={canEdit}
            editing={editing}
            onEditingChange={(open) => setNoteEditKey(open ? editKey : null)}
            onSave={(next) => saveWeekNote(week.weekStart, routeGroup.id, next)}
          />
          <RouteProgressBar
            done={stats.done}
            total={stats.total}
            name={routeGroup.name}
            className="absolute inset-x-0 bottom-0 bg-primary/15"
          />
        </div>
      </td>
    )
  }

  if (
    weeks.length === 0 ||
    weeks.every((w) => w.routeGroups.length === 0 && w.ungrouped.length === 0)
  ) {
    return <ScheduleEmptyState filtered={filtered} />
  }

  const structure = weeks[0]
  const structureRows = [
    ...structure.routeGroups.flatMap((g) => g.rows),
    ...structure.ungrouped,
  ]
  const selectableCount = structureRows.length * weeks.length
  // Each target carries its own week's visit — a structure row's `visit` is
  // only ever week 0's.
  const selectedTargets: BulkTarget[] = selectMode
    ? weeks.flatMap((week) =>
        structureRows
          .filter((row) => selected.has(cellKey(row.property.id, week.weekStart)))
          .map((row) => ({
            row: { ...row, visit: visitFor(row, week.weekStart) },
            weekStart: week.weekStart,
          })),
      )
    : []

  return (
    <>
      <div className="rounded-xl border border-border overflow-clip bg-card shadow-warm">
        {/* Its own scroll container so the <thead> can stick; the cap leaves room for the sticky
           filter bar and the selection bar. */}
        <div
          className="overflow-auto"
          style={{
            maxHeight: selectMode
              ? 'calc(100dvh - var(--schedule-sticky-h, 0px) - 15rem)'
              : 'calc(100dvh - var(--schedule-sticky-h, 0px) - 6.5rem)',
          }}
        >
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-card border-b border-border shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
              <tr>
                <th
                  className={cn(
                    'sticky left-0 z-30 bg-card px-4 py-2 text-left shadow-[inset_-1px_0_0_0_var(--border)]',
                    LABEL_COL_WIDTH,
                  )}
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Property
                  </span>
                </th>
                {weeks.map((week) => {
                  const isCurrent = week.weekStart === currentWeekStart
                  const isPastWeek = week.weekStart < currentWeekStart
                  const start = parseISO(week.weekStart)
                  return (
                    <th
                      key={week.weekStart}
                      className={cn(
                        'min-w-[176px] px-3 py-2 text-center',
                        isCurrent ? 'text-primary' : 'text-muted-foreground',
                        isPastWeek && 'bg-foreground/[0.04]'
                      )}
                    >
                      <span
                        className={cn(
                          'block text-sm tabular-nums',
                          isCurrent ? 'font-bold' : 'font-semibold'
                        )}
                      >
                        {format(start, 'MMM d')} – {format(addDays(start, 6), 'MMM d')}
                      </span>
                      {isCurrent && (
                        <span className="block text-[10px] font-medium text-primary/70 mt-0.5">
                          This week
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[
                ...structure.routeGroups.flatMap(({ routeGroup, rows }) => [
                  <tr key={`rg-${routeGroup.id}`} data-tour="schedule.routeBand">
                    {/* The route opens a section, so it reads as a heading: sage
                        band, Fraunces name, and a forest spine down the label. */}
                    <td
                      className={cn(
                        'sticky left-0 z-10 bg-accent text-accent-foreground align-middle border-t border-t-primary/20 pl-5 pr-4 py-2.5',
                        'shadow-[inset_3px_0_0_0_var(--primary),inset_-1px_0_0_0_var(--border)]',
                        LABEL_COL_WIDTH,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold leading-tight text-foreground">
                          {routeGroup.name}
                        </span>
                        {canEdit && (
                          <RouteGroupMenu
                            name={routeGroup.name}
                            items={[
                              {
                                label: 'Assign route…',
                                onClick: () => {
                                  openAssign(routeGroup)
                                },
                              },
                              { label: 'Route defaults…', onClick: () => setDefaultsGroup(routeGroup) },
                            ]}
                          />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-accent-foreground">
                        {(routeGroup.default_days ?? []).length > 0 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-semibold">
                            {formatDays(routeGroup.default_days ?? [])}
                          </span>
                        )}
                        {onGroupSortChange && (
                          <span className="ml-auto -mr-1.5">
                            <ScheduleSortToggle
                              size="compact"
                              scope={routeGroup.name}
                              mode={sortModeForGroup(sortState, routeGroup.id)}
                              onChange={(mode) => onGroupSortChange(routeGroup.id, mode)}
                            />
                          </span>
                        )}
                      </div>
                    </td>
                    {weeks.map((week) => renderRouteWeekCell(routeGroup, rows, week))}
                  </tr>,
                  // One-property accounts (~99%) merge account and site into one label cell.
                  ...groupRowsByAccount(orderRows(routeGroup.id, rows)).flatMap(({ account, rows: acctRows }) =>
                    renderPropertyRows(routeGroup.id, account, acctRows)
                  ),
                ]),
                // "Not on a route": last, in clay, with an inline route picker.
                ...(structure.ungrouped.length > 0
                  ? [
                      <tr key="ungrouped-header">
                        <td
                          colSpan={1 + weeks.length}
                          className="bg-[var(--clay)]/10 text-[var(--clay)] text-xs font-semibold uppercase tracking-widest py-2 border-b border-border"
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('sticky left-0 flex items-center gap-2 px-4', LABEL_COL_WIDTH)}>
                              <span className="truncate">Not on a route · {structure.ungrouped.length}</span>
                              {onGroupSortChange && (
                                <ScheduleSortToggle
                                  size="compact"
                                  scope="Stops with no route"
                                  mode={sortModeForGroup(sortState, UNGROUPED_SORT_KEY)}
                                  onChange={(mode) => onGroupSortChange(UNGROUPED_SORT_KEY, mode)}
                                  className="normal-case tracking-normal"
                                />
                              )}
                            </span>
                            {canEdit && (
                              <span className="mr-4 shrink-0 normal-case tracking-normal">
                                <RoutePicker
                                  routeGroups={reference?.routeGroups ?? []}
                                  label={`Route all ${structure.ungrouped.length}`}
                                  className="h-8 border-[var(--clay)]/40 text-[var(--clay)]"
                                  onSelect={(routeGroupId) =>
                                    void routeAllUngrouped(structure.ungrouped, routeGroupId)
                                  }
                                />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>,
                      ...groupRowsByAccount(orderRows(UNGROUPED_SORT_KEY, structure.ungrouped)).flatMap(({ account, rows: acctRows }) =>
                        renderPropertyRows('ungrouped', account, acctRows)
                      ),
                    ]
                  : []),
              ]}
            </tbody>
          </table>
        </div>
      </div>

      {selectMode && (
        <ScheduleBulkControls
          targets={selectedTargets}
          selectableCount={selectableCount}
          onSelectAll={() =>
            setSelected(
              new Set(
                weeks.flatMap((week) =>
                  structureRows.map((row) => cellKey(row.property.id, week.weekStart)),
                ),
              ),
            )
          }
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
          weeks={weeks}
          employees={employees}
          vehicles={vehicles}
        />
      )}
    </>
  )
}

// ─── Label column cells ────────────────────────────────────────────────────
//
// `merged` (one-property account), `nested` (under a multi-property header, sage rail), and the
// account header share one sticky column. No rate — this is a dispatch screen.

function PropertyLabelCell({
  account,
  property,
  variant,
  lastVisitOn,
}: {
  account: Account
  property: Property
  variant: 'merged' | 'nested'
  lastVisitOn: string | null
}) {
  const isNested = variant === 'nested'
  return (
    <td
      className={cn(
        'sticky left-0 z-10 bg-card group-hover:bg-accent/20 shadow-[inset_-1px_0_0_0_var(--border)] py-3 align-top transition-colors',
        LABEL_COL_WIDTH,
        isNested ? 'border-l-2 border-l-primary/25 pl-8 pr-4' : 'px-4',
      )}
    >
      {!isNested && (
        <div className="font-display text-[15px] font-semibold leading-snug text-foreground">
          {account.name}
        </div>
      )}
      <div className={cn('text-[13px] leading-snug text-muted-foreground', !isNested && 'mt-0.5')}>
        {property.address}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {/* Always counted here: this label spans all four weeks. */}
        <CadenceBadge property={property} lastVisitOn={lastVisitOn} showDays />
      </div>
    </td>
  )
}

function AccountHeaderLabelCell({ account, propertyCount }: { account: Account; propertyCount: number }) {
  return (
    <td
      className={cn(
        'sticky left-0 z-10 bg-card shadow-[inset_-1px_0_0_0_var(--border)] px-4 pt-3 pb-1.5 align-top',
        LABEL_COL_WIDTH,
      )}
    >
      <div className="font-display text-[15px] font-semibold leading-snug text-foreground truncate">
        {account.name}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{propertyCount} sites</div>
    </td>
  )
}

/** One property×week cell, matching the phone row, plus completed date and photo count. */
function ScheduleCell({
  visit,
  isCreating,
  selectMode,
  isSelected,
  onClick,
  onKeyDown,
}: {
  visit: VisitWithCrew | null
  isCreating: boolean
  selectMode: boolean
  isSelected: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  const base =
    'relative min-h-[52px] rounded-lg px-2 py-1.5 flex gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring select-none'
  const selection = selectMode && isSelected && 'ring-2 ring-primary bg-accent/40'

  if (isCreating) {
    return (
      <div className={cn(base, 'bg-muted/50 opacity-50 cursor-wait items-center justify-center')}>
        <span className="text-muted-foreground/50 text-sm">…</span>
      </div>
    )
  }

  if (!visit) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selectMode ? isSelected : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          base,
          'items-center justify-center border border-dashed border-border/70 hover:bg-muted/50',
          selectMode ? 'cursor-pointer' : 'cursor-cell',
          selection,
        )}
        title={selectMode ? undefined : 'Click to schedule, or press S to schedule without opening it'}
      >
        {selectMode && <CheckIndicator checked={isSelected} className="absolute left-2 top-2" />}
        <span className="text-muted-foreground/40 text-lg leading-none">+</span>
        <span className="sr-only">Not scheduled</span>
      </div>
    )
  }

  const inProgress = isVisitInProgress(visit)
  const settled = visit.status === 'completed' || visit.status === 'skipped'
  const displayCrew = displayCrewFor(visit)
  const crewLabel = displayCrew.slice(0, 2).map((emp) => firstName(emp.name)).join(', ')
  const overflow = displayCrew.length - 2

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? isSelected : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        base,
        'items-start cursor-pointer border border-border/60 transition-[filter] hover:brightness-[0.97]',
        visitRowTint(visit.status),
        settled && 'border-transparent',
        selection,
      )}
    >
      {selectMode && <CheckIndicator checked={isSelected} className="mt-0.5" />}

      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5 text-[11px] leading-snug', settled ? 'text-muted-foreground' : 'text-foreground')}>
        <span className="truncate">
          {crewLabel || <span className="text-muted-foreground/70">No crew</span>}
          {overflow > 0 && ` +${overflow}`}
        </span>

        {visit.status === 'completed' && (visit.ended_at || Boolean(visit.photo_count) || visit.invoice) && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground">
            {visit.ended_at && (
              <span className="tabular-nums">{format(parseISO(visit.ended_at), 'MMM d')}</span>
            )}
            {Boolean(visit.photo_count) && (
              <span
                className="inline-flex items-center gap-0.5"
                title={visit.photo_count === 1 ? '1 photo' : `${visit.photo_count} photos`}
              >
                <Camera className="h-3 w-3" aria-hidden />
                <span className="tabular-nums">{visit.photo_count}</span>
              </span>
            )}
            {visit.invoice && (
              <span className="ink-invoiced flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                <Receipt className="h-2.5 w-2.5 shrink-0" aria-hidden />
                {invoiceStatusLabel(visit.invoice.status)}
              </span>
            )}
          </span>
        )}

        {/* The spreadsheet's orange cell, readable inline rather than behind a
            hover-only tooltip; the title carries the full text past the clamp. */}
        {visit.crew_instruction && (
          <span
            className="mt-0.5 flex items-start gap-1 text-[var(--clay)]"
            title={visit.crew_instruction}
          >
            <FilePen className="mt-px h-3 w-3 shrink-0" aria-hidden />
            <span className="line-clamp-2">{visit.crew_instruction}</span>
          </span>
        )}
      </div>

      {/* Right: the live clock or the status mark — never both. */}
      {inProgress && visit.started_at ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-[var(--clay)]">
          <VisitStatusIcon status={visit.status} inProgress />
          {formatElapsed(visit.started_at)}
        </span>
      ) : (
        <span className="flex shrink-0">
          <VisitStatusIcon status={visit.status} />
        </span>
      )}
    </div>
  )
}
