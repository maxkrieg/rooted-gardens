'use client'

import { useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ChevronLeft, FilePen, Flag, MoreHorizontal, Receipt, Truck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useKeyboardOpen } from '@/hooks/use-keyboard-open'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignSheet } from '@/components/management/RouteAssignSheets'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import {
  RouteGroupBand,
  RouteViewHeader,
} from '@/components/management/RouteGroupBand'
import { ScheduleBulkControls } from '@/components/management/ScheduleBulkControls'
import type { BulkTarget } from '@/hooks/useBulkScheduleActions'
import { CheckIndicator } from '@/components/app/CheckIndicator'
import { WeekNoteRibbon } from '@/components/management/WeekNoteRibbon'
import { RouteDefaultsSheet } from '@/components/management/RouteDefaultsSheet'
import { RoutePicker } from '@/components/management/RoutePicker'
import { useScheduleInteractions, type OpenVisit } from '@/hooks/useScheduleInteractions'
import { useWeekNotes } from '@/hooks/useWeekNotes'
import { isVisitInProgress, formatElapsed, displayCrewFor } from '@/lib/utils/visits'
import {
  groupRowsByAccount,
  routeAssignment,
  routeGroupStats,
  type RouteAssignment,
} from '@/lib/utils/schedule'
import {
  DEFAULT_SCHEDULE_SORT,
  UNGROUPED_SORT_KEY,
  type ScheduleSortMode,
  type ScheduleSortState,
} from '@/lib/utils/schedule-sort'
import { ScheduleSortToggle } from '@/components/management/ScheduleSortToggle'
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
import { firstName } from '@/lib/utils/team'

interface ScheduleListMobileProps {
  /** The single week on screen, already filtered. */
  week: ScheduleWeek | undefined
  /** The unfiltered window. Crew and Truck change every scheduled stop, so they count from it. */
  windowWeeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  /** True when a filter is narrowing the view — changes the empty state's meaning. */
  filtered?: boolean
  /** Rows become checkboxes and the bulk bar appears. Owned by ScheduleView so
   *  the header's `⋯ → Select` can toggle it. */
  selectMode?: boolean
  onExitSelectMode?: () => void
  /** Owned by ScheduleView. The route view's header carries the switch that changes it. */
  sortState?: ScheduleSortState
  onSortChange?: (mode: ScheduleSortMode) => void
  /** Render one route alone (a route group id, or UNGROUPED_SORT_KEY): the drill-in from the
   *  week overview. Absent renders every route, which is crew's flat list. */
  routeGroupId?: string
  /** The route view's `‹ Week`. */
  onBack?: () => void
  /** Enter select mode from the route view's ⋯. */
  onStartSelect?: () => void
  /** 'pane' = the desktop board's middle pane: it scrolls itself, and the action bar sits in it. */
  layout?: 'page' | 'pane'
  /** The board opens stops in its right pane instead of this list's sheet. */
  onOpenVisit?: OpenVisit
  /** The stop showing in the board's right pane, highlighted here. */
  activeVisitId?: string
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
  onSortChange,
  routeGroupId,
  onBack,
  onStartSelect,
  layout = 'page',
  onOpenVisit,
  activeVisitId,
}: ScheduleListMobileProps) {
  const inPane = layout === 'pane'
  const topRef = useRef<HTMLDivElement>(null)
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
    assignTarget,
    setAssignTarget,
    defaultsGroup,
    setDefaultsGroup,
    // Lifted here because the band's ⋯ opens the note editor and the ribbon renders it.
    noteEditKey: noteEditGroupId,
    setNoteEditKey: setNoteEditGroupId,
    selected,
    setSelected,
  } = useScheduleInteractions({
    selectMode,
    sortState,
    windowStart: week?.weekStart,
    onOpenVisit,
  })
  const { data: weekNotes = [] } = useWeekNotes(week?.weekStart ?? '')

  /** Band stats read the same merged visits as the rows, so they can't disagree. */
  function visitsFor(rows: SchedulePropertyRow[], weekStart: string) {
    return rows.map(
      (row) => row.visit ?? createdVisits.get(`${row.property.id}-${weekStart}`) ?? null,
    )
  }
  function statsFor(rows: SchedulePropertyRow[], weekStart: string) {
    return routeGroupStats(visitsFor(rows, weekStart), vehicles)
  }
  /** Ignores filters: the write covers the whole route, so the summary and count must too. */
  function assignmentFor(routeGroupId: string, weekStart: string) {
    const unfiltered = windowWeeks
      .find((w) => w.weekStart === weekStart)
      ?.routeGroups.find((g) => g.routeGroup.id === routeGroupId)
    return routeAssignment(visitsFor(unfiltered?.rows ?? [], weekStart))
  }

  function handleRowClick(row: SchedulePropertyRow, visit: VisitWithCrew | null) {
    if (!week) return
    if (visit) {
      openSheet(row, visit, week.weekStart)
    } else {
      void scheduleVisit(row, week.weekStart, { openDrawer: true })
    }
  }

  const routeView = routeGroupId !== undefined
  // The route view renders one bucket; everything below (select all, counts) follows it.
  const groups = !week
    ? []
    : routeView
      ? week.routeGroups.filter((g) => g.routeGroup.id === routeGroupId)
      : week.routeGroups
  const ungrouped =
    !week || (routeView && routeGroupId !== UNGROUPED_SORT_KEY) ? [] : week.ungrouped

  if (!week || (groups.length === 0 && ungrouped.length === 0)) {
    return (
      <>
        {/* A filter can empty the open route; the header that carries Back isn't rendered then. */}
        {routeView && onBack && (
          <Button variant="ghost" className="mx-2 mb-2 h-11 gap-0.5 px-2" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
            Week
          </Button>
        )}
        <ScheduleEmptyState filtered={filtered} />
      </>
    )
  }
  const currentWeek = week
  const weekStartDate = parseISO(currentWeek.weekStart)
  const weekLabel = `${format(weekStartDate, 'MMM d')} – ${format(addDays(weekStartDate, 6), 'MMM d')}`
  const sortToggle = onSortChange && (
    <ScheduleSortToggle
      size="icon"
      scope="This route"
      mode={sortState.all}
      onChange={onSortChange}
    />
  )

  const allRows = [...groups.flatMap((g) => g.rows), ...ungrouped]
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

  // One stop button for both shapes: `merged` (one-property account) and `nested` (under a
  // multi-property header, with the sage rail). Status is a gutter glyph plus row tint; settled
  // visits recede, so outstanding work stands out.
  function renderStopRow(
    account: Account,
    row: SchedulePropertyRow,
    variant: 'merged' | 'nested',
    showTopBorder: boolean,
  ) {
    const isNested = variant === 'nested'
    const cellKey = `${row.property.id}-${currentWeek.weekStart}`
    const isCreating = creatingKey === cellKey
    // Server data wins; the local map only covers the gap after an insert.
    const visit = row.visit ?? createdVisits.get(cellKey) ?? null
    const effectiveStartedAt = visit?.started_at ?? null
    const inProgress = visit ? isVisitInProgress(visit) : false
    const displayCrew = visit ? displayCrewFor(visit) : []
    const displayedCrew = displayCrew.slice(0, 2)
    const overflow = displayCrew.length - 2

    const isSelected = selected.has(row.property.id)
    const isActive = Boolean(activeVisitId && visit?.id === activeVisitId)
    const settled = visit?.status === 'completed' || visit?.status === 'skipped'
    const crewLabel = displayedCrew.map((emp) => firstName(emp.name)).join(', ')

    return (
      <button
        key={row.property.id}
        type="button"
        // Only rows that already have a visit: tapping an empty one creates it.
        data-tour={visit ? 'schedule.stop' : undefined}
        // The desktop board's ↑/↓ walks these.
        data-stop-row=""
        disabled={isCreating}
        aria-pressed={selectMode ? isSelected : undefined}
        aria-current={isActive ? 'true' : undefined}
        onClick={() =>
          selectMode ? toggleSelected(row.property.id) : handleRowClick(row, visit)
        }
        onKeyDown={(e) => {
          // S schedules without opening: the fast path for filling several stops in a row.
          if (e.key.toLowerCase() !== 's' || visit || selectMode || isCreating || !week) return
          if (!canEdit || e.metaKey || e.ctrlKey || e.altKey) return
          e.preventDefault()
          void scheduleVisit(row, week.weekStart, { openDrawer: false })
        }}
        className={cn(
          'w-full text-left py-3 min-h-[56px]',
          'flex items-start gap-3',
          isNested ? 'border-l-2 border-l-foreground/15 pl-6 pr-4' : 'px-4',
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
          // The open stop: the same ink spine as the selected route. The stone fill only
          // where there's no status wash to keep.
          isActive && 'shadow-[inset_3px_0_0_0_var(--foreground)]',
          isActive && !settled && !(selectMode && isSelected) && 'bg-secondary',
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
          {/* One meta line: cadence, crew, invoice. No rate — this is a dispatch screen. */}
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
          {/* The crew instruction (the sheet's orange cell), shown inline — phones have no hover. */}
          {visit?.crew_instruction && (
            <span className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-[var(--clay)]">
              <FilePen className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span className="line-clamp-2">{visit.crew_instruction}</span>
            </span>
          )}
        </div>

        {/* At most one of: status mark, live clock, schedule action. Scheduled shows nothing. */}
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

  // Multi-property account header above its nested property rows.
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

  function renderRows(groupKey: string, rows: SchedulePropertyRow[]) {
    return groupRowsByAccount(orderRows(groupKey, rows)).map(({ account, rows: acctRows }, acctIdx) => {
      if (acctRows.length === 1) {
        return renderStopRow(account, acctRows[0], 'merged', acctIdx > 0)
      }
      return (
        <div key={account.id}>
          <AccountHeaderRow account={account} propertyCount={acctRows.length} showTopBorder={acctIdx > 0} />
          {acctRows.map((row, rowIdx) => renderStopRow(account, row, 'nested', rowIdx > 0))}
        </div>
      )
    })
  }

  function noteRibbon(routeGroup: RouteGroup) {
    return (
      <WeekNoteRibbon
        note={weekNotes.find((n) => n.route_group_id === routeGroup.id)?.note ?? null}
        canEdit={canEdit}
        editing={noteEditGroupId === routeGroup.id}
        onEditingChange={(open) => setNoteEditGroupId(open ? routeGroup.id : null)}
        onSave={(note) => saveWeekNote(currentWeek.weekStart, routeGroup.id, note)}
      />
    )
  }

  const routeAllPicker = canEdit && (
    <RoutePicker
      routeGroups={reference?.routeGroups ?? []}
      label={`Route all ${ungrouped.length}`}
      className="h-8 border-[var(--clay)]/40 text-[var(--clay)]"
      onSelect={(routeGroupId) => void routeAllUngrouped(ungrouped, routeGroupId)}
    />
  )

  // Sticks under ScheduleView's header, which collapses to nothing on the route view. A pane
  // scrolls itself, so there it sticks to the pane's top.
  const stickyTop = { top: inPane ? 0 : 'var(--schedule-sticky-h, 0px)' }
  const showActionBar = routeView && canEdit && !selectMode

  return (
    <>
      {/* In a pane the route fills the height, so a short route still has its bar at the bottom. */}
      <div ref={topRef} className={cn(inPane ? 'flex min-h-full flex-col' : 'space-y-3')}>
        {groups.map(({ routeGroup, rows }) => {
          const stats = statsFor(rows, currentWeek.weekStart)
          return (
            <div
              key={routeGroup.id}
              /* Full-bleed on a phone (ScheduleView cancels the page padding), so
                 there are no side edges to round or shadow — just hairlines. */
              className={cn('bg-card', inPane ? 'flex flex-1 flex-col' : 'border-y border-border')}
            >
              {routeView && onBack ? (
                <>
                  <div className="sticky z-10" style={stickyTop}>
                    <RouteViewHeader
                      name={routeGroup.name}
                      weekLabel={weekLabel}
                      done={stats.done}
                      total={stats.total}
                      onSite={stats.onSite}
                      onBack={onBack}
                      plan={{
                        days: routeGroup.default_days ?? [],
                        crew: stats.crew,
                        vehicles: stats.vehicles,
                      }}
                      trailing={sortToggle}
                    />
                  </div>
                  {noteRibbon(routeGroup)}
                </>
              ) : (
                // Sticks under the header (height from --schedule-sticky-h). The card must not
                // clip overflow.
                <div className="sticky z-10" style={stickyTop}>
                  <RouteGroupBand
                    name={routeGroup.name}
                    days={routeGroup.default_days ?? []}
                    stats={stats}
                    canEdit={canEdit}
                    onAssign={(kind) => setAssignTarget({ group: routeGroup, kind })}
                    onEditDefaults={() => setDefaultsGroup(routeGroup)}
                    onEditNote={() => setNoteEditGroupId(routeGroup.id)}
                    hasNote={weekNotes.some((n) => n.route_group_id === routeGroup.id)}
                    noteSlot={noteRibbon(routeGroup)}
                  />
                </div>
              )}

              {/* Properties, nested by account */}
              <div className={cn('overflow-hidden', inPane && 'flex-1')}>{renderRows(routeGroup.id, rows)}</div>

              {showActionBar && (
                <RouteActionBar
                  inline={inPane}
                  hasNote={weekNotes.some((n) => n.route_group_id === routeGroup.id)}
                  assignment={assignmentFor(routeGroup.id, currentWeek.weekStart)}
                  employees={employees}
                  vehicles={vehicles}
                  onAssign={(kind) => setAssignTarget({ group: routeGroup, kind })}
                  onEditNote={() => {
                    setNoteEditGroupId(routeGroup.id)
                    // The editor opens in the header area; bring it into view.
                    if (inPane) topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                    else window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  menuItems={[
                    { label: 'Route defaults…', onClick: () => setDefaultsGroup(routeGroup) },
                    ...(onStartSelect ? [{ label: 'Select stops', onClick: onStartSelect }] : []),
                  ]}
                />
              )}
            </div>
          )
        })}

        {ungrouped.length > 0 && (
          <div
            className={cn(
              'bg-card',
              inPane ? 'flex flex-1 flex-col' : 'border-y border-[var(--clay)]/30',
            )}
          >
            {/* "Not on a route" — properties with no property_route_groups row.
                These used to be silently dropped from the schedule entirely. */}
            {routeView && onBack ? (
              <>
                <div className="sticky z-10" style={stickyTop}>
                  <RouteViewHeader
                    name={`Not on a route · ${ungrouped.length}`}
                    weekLabel={weekLabel}
                    done={0}
                    total={ungrouped.length}
                    onSite={false}
                    onBack={onBack}
                    trailing={sortToggle}
                    tone="unrouted"
                  />
                </div>
                {routeAllPicker && (
                  <div className="flex items-center gap-2 border-b border-[var(--clay)]/30 bg-[var(--clay)]/10 px-4 py-2">
                    {routeAllPicker}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[var(--clay)]/10 text-[var(--clay)] flex items-center justify-between px-4 py-2.5 border-b border-[var(--clay)]/30">
                <span className="truncate text-xs font-semibold uppercase tracking-widest">
                  Not on a route · {ungrouped.length}
                </span>
                {/* Was a link to /app/routes carrying no context — you arrived at
                    a list of every route with no memory of which stop sent you. */}
                {routeAllPicker}
              </div>
            )}
            <div className={cn('overflow-hidden', inPane && 'flex-1')}>{renderRows(UNGROUPED_SORT_KEY, ungrouped)}</div>

            {showActionBar && onStartSelect && (
              <RouteActionBar
                inline={inPane}
                menuItems={[{ label: 'Select stops', onClick: onStartSelect }]}
              />
            )}
          </div>
        )}

        {/* Room for the fixed action bar, so the last stop can scroll clear of it. */}
        {showActionBar && !inPane && <div aria-hidden className="h-16" />}
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

      {assignTarget && (
        <RouteAssignSheet
          kind={assignTarget.kind}
          onOpenChange={(open) => !open && setAssignTarget(null)}
          routeGroup={assignTarget.group}
          weekStart={currentWeek.weekStart}
          assignment={assignmentFor(assignTarget.group.id, currentWeek.weekStart)}
          employees={employees}
          vehicles={vehicles}
        />
      )}
    </>
  )
}

/**
 * The route view's actions, fixed above the app's bottom nav like /app/stop's bar so they sit
 * in thumb reach. Hidden while the keyboard is up, as the nav is.
 */
function RouteActionBar({
  inline = false,
  hasNote,
  assignment,
  employees = [],
  vehicles = [],
  onAssign,
  onEditNote,
  menuItems,
}: {
  /** In the desktop board's pane: sticks to the pane's bottom instead of the screen's. */
  inline?: boolean
  hasNote?: boolean
  /** What the scheduled stops are set to, shown on the Crew and Truck buttons. */
  assignment?: RouteAssignment
  employees?: Employee[]
  vehicles?: Vehicle[]
  /** Crew and Truck each open their own sheet, which sets only that for the whole route. */
  onAssign?: (kind: 'crew' | 'truck') => void
  onEditNote?: () => void
  menuItems: Array<{ label: string; onClick: () => void }>
}) {
  const keyboardOpen = useKeyboardOpen()
  const [menuOpen, setMenuOpen] = useState(false)
  if (keyboardOpen) return null

  return (
    <div
      data-tour="schedule.routeActions"
      className={cn(
        'z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur',
        inline ? 'sticky bottom-0' : 'fixed inset-x-0 lg:hidden',
      )}
      style={inline ? undefined : { bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex gap-2">
        {onAssign && (
          <>
            <AssignButton
              icon={Users}
              label="Crew"
              value={crewSummary(assignment, employees)}
              onClick={() => onAssign('crew')}
            />
            <AssignButton
              icon={Truck}
              label="Truck"
              value={truckSummary(assignment, vehicles)}
              onClick={() => onAssign('truck')}
            />
          </>
        )}
        {onEditNote && (
          <Button variant="outline" className="h-11 flex-1 gap-1.5" onClick={onEditNote}>
            <Flag className="h-4 w-4" aria-hidden />
            {hasNote ? 'Note' : 'Add note'}
          </Button>
        )}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('h-11 gap-1.5', onAssign ? 'w-11 shrink-0 px-0' : 'flex-1')}
              aria-label="More route actions"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              {!onAssign && 'More'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-52 p-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  item.onClick()
                }}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {item.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

/** A bar button that says what's set: "Crew · MS JT", "Truck · Green Tacoma". */
function AssignButton({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Users
  label: string
  value: string | null
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      className="h-11 min-w-0 flex-1 gap-1.5 px-2.5"
      onClick={onClick}
      aria-label={value ? `${label}: ${value}. Change` : `Set ${label.toLowerCase()}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">
        {label}
        {value && <span className="font-normal text-muted-foreground"> · {value}</span>}
      </span>
    </Button>
  )
}

function crewSummary(assignment: RouteAssignment | undefined, employees: Employee[]) {
  if (!assignment || assignment.crewIds.length === 0) return null
  if (assignment.crewMixed) return 'Mixed'
  return assignment.crewIds
    .map((id) => employees.find((e) => e.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .map((name) =>
      name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join(''),
    )
    .join(' ')
}

function truckSummary(assignment: RouteAssignment | undefined, vehicles: Vehicle[]) {
  if (!assignment) return null
  if (assignment.vehicleMixed) return 'Mixed'
  return vehicles.find((v) => v.id === assignment.vehicleId)?.name ?? null
}
