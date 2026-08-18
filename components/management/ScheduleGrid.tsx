'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getWeekStart, groupRowsByAccount } from '@/lib/utils/schedule'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { createVisit } from '@/app/management/schedule/actions'
import { toUserMessage } from '@/lib/errors'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import { useVisitOverlays } from '@/components/management/SessionsProvider'
import { isVisitInProgress, formatElapsed, mergeVisitOverlay } from '@/lib/utils/visits'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilePen, Camera } from 'lucide-react'
import { AccountPriceMeta, FrequencyBadge, BillingTypeBadge, InvoiceStatusBadge } from '@/components/management/badges'
import type {
  Account,
  Employee,
  EmployeeRole,
  Property,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

// Shared width for the sticky label column — kept in one place so the header
// `<th>`, the merged/nested label cells, and the pinned route-group banner
// below can never drift out of sync.
const LABEL_COL_WIDTH = 'w-[260px] min-w-[260px]'

interface ScheduleGridProps {
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  canEdit: boolean
  role: EmployeeRole | undefined
  /** True when a filter is narrowing the view — changes the empty state's meaning. */
  filtered?: boolean
}

export function ScheduleGrid({ weeks, employees, vehicles, canEdit, role, filtered }: ScheduleGridProps) {
  const currentWeekStart = useMemo(
    () => format(getWeekStart(new Date()), 'yyyy-MM-dd'),
    []
  )
  const visitOverlays = useVisitOverlays()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<SchedulePropertyRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  // Visits created in this session, keyed by cell. Layered *under* the server
  // props in renderWeekCell so a just-scheduled cell paints immediately instead
  // of waiting on revalidatePath — and never cleared, since clearing it would
  // race the props catching up (the routes-page freeze, commit f4e09e3).
  const [createdVisits, setCreatedVisits] = useState<Map<string, VisitWithCrew>>(new Map())

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroup, setAssignGroup] = useState<RouteGroup | null>(null)

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

  function openSheet(row: SchedulePropertyRow, visit: VisitWithCrew, weekStart: string) {
    setSheetRow({ ...row, visit })
    setSheetWeek(weekStart)
    setSheetOpen(true)
    // weeks[0] is the leftmost rendered column — the window the server built.
    syncVisitUrlParam(visit.id, weeks[0]?.weekStart)
  }

  /**
   * Schedule an empty cell. `openDrawer` is true for a click — the owner almost
   * always wants to set crew or an instruction next, so opening straight away
   * saves a second tap on a small target. The `S` shortcut passes false to keep
   * a fast path for filling a week without a drawer each time.
   *
   * Deliberately not wrapped in startTransition: the drawer state must be an
   * urgent update, or it queues behind the revalidated RSC tree and reads as a
   * frozen cell.
   */
  async function scheduleCell(
    row: SchedulePropertyRow,
    weekStart: string,
    { openDrawer }: { openDrawer: boolean },
  ) {
    const cellKey = `${row.property.id}-${weekStart}`
    setCreatingKey(cellKey)
    try {
      const res = await createVisit(row.property.id, weekStart, row.account.id)
      if (res.error || !res.visit) {
        toast.error('Failed to create visit', { description: res.error })
        return
      }
      const visit = res.visit
      setCreatedVisits((prev) => new Map(prev).set(cellKey, visit))
      if (openDrawer) openSheet(row, visit, weekStart)
    } catch (err) {
      // A thrown failure (dropped connection mid-action) never reaches the
      // res.error branch, and would leave the cell stuck on its placeholder.
      toast.error('Failed to create visit', {
        description: toUserMessage(err, 'Could not add the stop.', '[ScheduleGrid.scheduleCell]'),
      })
    } finally {
      setCreatingKey(null)
    }
  }

  function handleCellClick(row: SchedulePropertyRow, weekStart: string, visit: VisitWithCrew | null) {
    if (visit) {
      openSheet(row, visit, weekStart)
    } else {
      void scheduleCell(row, weekStart, { openDrawer: true })
    }
  }

  function handleSheetOpenChange(next: boolean) {
    setSheetOpen(next)
    if (!next) syncVisitUrlParam(null)
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    row: SchedulePropertyRow,
    weekStart: string,
    visit: VisitWithCrew | null,
  ) {
    // Schedule without opening the drawer — the fast path for filling several
    // cells in a row. A click (or Enter/Space, below) opens it.
    if ((e.key === 's' || e.key === 'S') && !visit) {
      e.preventDefault()
      void scheduleCell(row, weekStart, { openDrawer: false })
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCellClick(row, weekStart, visit)
    }
  }

  function renderWeekCell(row: SchedulePropertyRow, week: ScheduleWeek) {
    const cellKey = `${row.property.id}-${week.weekStart}`
    // Server data wins once the revalidated render lands; the local map only
    // covers the gap between the insert and that render.
    const base =
      visitMap.get(row.property.id)?.get(week.weekStart) ?? createdVisits.get(cellKey) ?? null
    // Layer the live overlay (realtime UPDATEs + the drawer's own writes) over
    // the server row, so status, timing, and the instruction flag all repaint
    // without waiting on a server render.
    const visit = base ? mergeVisitOverlay(base, visitOverlays) : null
    const inProgress = visit ? isVisitInProgress(visit) : false
    // week.weekStart and currentWeekStart are both 'yyyy-MM-dd', so this sorts lexicographically.
    const isPastWeek = week.weekStart < currentWeekStart
    return (
      <td key={week.weekStart} className={cn('px-2 py-2 align-top', isPastWeek && 'bg-foreground/[0.04]')}>
        <ScheduleCell
          visit={visit}
          inProgress={inProgress}
          startedAt={visit?.started_at ?? null}
          isCreating={creatingKey === cellKey}
          onClick={() => handleCellClick(row, week.weekStart, visit)}
          onKeyDown={(e) => handleCellKeyDown(e, row, week.weekStart, visit)}
        />
      </td>
    )
  }

  // Renders one account's rows within either a route group or the ungrouped
  // bucket — shared so the "Not on a route" section gets the exact same
  // merged/nested account-clustering treatment as a real route group.
  function renderPropertyRows(keyPrefix: string, account: Account, acctRows: SchedulePropertyRow[]) {
    if (acctRows.length === 1) {
      const row = acctRows[0]
      return [
        <tr
          key={`${keyPrefix}-${row.property.id}`}
          className="group border-b border-border/50 hover:bg-accent/20 transition-colors"
        >
          <PropertyLabelCell account={account} property={row.property} variant="merged" />
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
          <PropertyLabelCell account={account} property={row.property} variant="nested" />
          {weeks.map((week) => renderWeekCell(row, week))}
        </tr>
      )),
    ]
  }

  if (
    weeks.length === 0 ||
    weeks.every((w) => w.routeGroups.length === 0 && w.ungrouped.length === 0)
  ) {
    return <ScheduleEmptyState filtered={filtered} />
  }

  const structure = weeks[0]

  return (
    <>
      <div className="rounded-xl border border-border overflow-clip bg-card shadow-warm">
        {/* A bounded, internally-scrolling pane rather than relying on page
            scroll — CSS won't allow a horizontally-scrollable ancestor (needed
            for narrow viewports) to also host a <thead> that's sticky to the
            *page* (any ancestor with overflow-x set becomes a scroll container
            on both axes, which hijacks position:sticky's reference frame away
            from the real viewport). Giving this div its own bounded height +
            overflow-auto sidesteps that entirely: it's a genuine scroll
            container, so `sticky top-0` on the header works as the ordinary,
            well-supported case. Height caps at the viewport minus the sticky
            filter bar above it (--schedule-sticky-h, published by
            ScheduleStickyBar) and a fixed allowance for the title/padding
            above that and breathing room below; shorter schedules just don't
            reach the cap and never show a scrollbar. */}
        <div
          className="overflow-auto"
          style={{ maxHeight: 'calc(100dvh - var(--schedule-sticky-h, 0px) - 6.5rem)' }}
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
                        'min-w-[160px] px-3 py-2 text-center',
                        isCurrent ? 'text-primary' : 'text-muted-foreground',
                        isPastWeek && 'bg-foreground/[0.04]'
                      )}
                    >
                      <Link
                        href={`/crew/schedule?week=${week.weekStart}`}
                        className="block rounded-md px-1 py-0.5 hover:bg-accent/40 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={`Open the crew schedule for ${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`}
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
                      </Link>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[
                ...structure.routeGroups.flatMap(({ routeGroup, rows }) => [
                  <tr key={`rg-${routeGroup.id}`}>
                    <td
                      colSpan={1 + weeks.length}
                      className="bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-widest py-2 border-b border-border"
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('sticky left-0 px-4', LABEL_COL_WIDTH)}>
                          {routeGroup.name}
                        </span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mr-4 px-2 text-xs font-medium text-secondary-foreground/70 hover:text-foreground hover:bg-secondary-foreground/10 normal-case tracking-normal shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAssignGroup(routeGroup)
                              setAssignOpen(true)
                            }}
                          >
                            Assign Route
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  // ~99% of accounts have exactly one property — merge the account
                  // identity and its single site into one label cell instead of a
                  // separate spanning header row. Only accounts with multiple sites
                  // get a real header row + indented, railed property rows below it.
                  ...groupRowsByAccount(rows).flatMap(({ account, rows: acctRows }) =>
                    renderPropertyRows(routeGroup.id, account, acctRows)
                  ),
                ]),
                // "Not on a route" — properties with no property_route_groups row.
                // Rendered last, in clay, with a link back to Routes to fix it;
                // these used to be silently dropped from the schedule entirely.
                ...(structure.ungrouped.length > 0
                  ? [
                      <tr key="ungrouped-header">
                        <td
                          colSpan={1 + weeks.length}
                          className="bg-[var(--clay)]/10 text-[var(--clay)] text-xs font-semibold uppercase tracking-widest py-2 border-b border-border"
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('sticky left-0 px-4', LABEL_COL_WIDTH)}>
                              Not on a route · {structure.ungrouped.length}
                            </span>
                            <Link
                              href="/management/routes"
                              className="mr-4 px-2 text-xs font-medium normal-case tracking-normal text-[var(--clay)]/80 hover:text-[var(--clay)] shrink-0"
                            >
                              Put on a route →
                            </Link>
                          </div>
                        </td>
                      </tr>,
                      ...groupRowsByAccount(structure.ungrouped).flatMap(({ account, rows: acctRows }) =>
                        renderPropertyRows('ungrouped', account, acctRows)
                      ),
                    ]
                  : []),
              ]}
            </tbody>
          </table>
        </div>
      </div>

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          row={sheetRow}
          weekStart={sheetWeek}
          role={role}
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
// Three shapes share one sticky, fixed-width column so its right edge and
// hover highlight stay continuous no matter which shape a given row uses:
//   - `merged`  — the ~99% case: one account with one property. Account name,
//                 full address, and frequency/price all live in a single cell.
//   - `nested`  — a property row under a multi-property account header. Only
//                 these carry the sage rail — it means "a site of the account
//                 above," not "this is a property row."
//   - the multi-property account header itself (`AccountHeaderLabelCell`).

function PropertyLabelCell({
  account,
  property,
  variant,
}: {
  account: Account
  property: Property
  variant: 'merged' | 'nested'
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
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <FrequencyBadge frequency={property.frequency} />
        {!isNested && <AccountPriceMeta account={account} />}
      </div>
    </td>
  )
}

function AccountHeaderLabelCell({ account, propertyCount }: { account: Account; propertyCount: number }) {
  const price = formatAccountPrice(account)
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
      <div className="mt-0.5 flex items-center gap-2">
        {price !== '—' ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">{price}</span>
        ) : (
          <BillingTypeBadge billingType={account.billing_type} />
        )}
        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{propertyCount} sites</span>
      </div>
    </td>
  )
}

function ScheduleCell({
  visit,
  inProgress,
  startedAt,
  isCreating,
  onClick,
  onKeyDown,
}: {
  visit: VisitWithCrew | null
  inProgress: boolean
  startedAt: string | null
  isCreating: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  // Tick elapsed time every 30s while in progress
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!inProgress) return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [inProgress])

  const base =
    'min-h-[48px] rounded-lg px-2 py-2 flex flex-col justify-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity select-none'

  if (isCreating) {
    return (
      <div className={cn(base, 'bg-muted/50 opacity-50 cursor-wait items-center')}>
        <span className="text-muted-foreground/50 text-sm">…</span>
      </div>
    )
  }

  if (!visit) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(base, 'bg-muted/30 cursor-cell hover:bg-muted/60 items-center')}
        title="Click or press S to schedule"
      >
        <span className="text-muted-foreground/30 text-lg leading-none">+</span>
      </div>
    )
  }

  const hasInstruction = Boolean(visit.crew_instruction)

  // Once a visit is completed, show who actually did the work rather than who was
  // planned — falls back to assigned crew if no completion crew was recorded.
  const assignedCrew = visit.visit_crew
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => vc.employee!)
  const completedCrew = visit.visit_crew
    .filter((vc) => vc.relation === 'completed' && vc.employee)
    .map((vc) => vc.employee!)
  const displayCrew = visit.status === 'completed' && completedCrew.length > 0 ? completedCrew : assignedCrew
  const displayedCrew = displayCrew.slice(0, 2)
  const overflow = displayCrew.length - 2

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        base,
        'relative',
        `status-${visit.status}`,
        'cursor-pointer hover:brightness-95',
      )}
    >
      {hasInstruction && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="absolute top-1 right-1 text-[var(--clay)] leading-none"
                onClick={(e) => e.stopPropagation()}
              >
                <FilePen className="w-4 h-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-xs whitespace-pre-wrap">
              {visit.crew_instruction}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {inProgress && startedAt ? (
        /* On-site overlay — replaces status text when crew is active */
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
            <span className="text-[11px] font-semibold text-[var(--clay)] leading-tight">
              On site
            </span>
          </div>
          <span className="text-[11px] text-[var(--clay)]/80 tabular-nums leading-tight">
            {formatElapsed(startedAt)}
          </span>
          {assignedCrew[0] && (
            <span className="text-[10px] bg-[var(--clay)]/15 rounded px-1 leading-4 truncate max-w-[52px]">
              {assignedCrew[0].name.split(' ')[0]}
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider leading-tight">
              {visit.status}
            </span>
          </div>
          {visit.status === 'completed' && visit.ended_at && (
            <span className="flex items-center gap-1">
              <span className="text-[11px] opacity-80 tabular-nums">
                {format(parseISO(visit.ended_at), 'MMM d')}
              </span>
              {Boolean(visit.photo_count) && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center gap-0.5 opacity-70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Camera className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {visit.photo_count === 1 ? '1 photo' : `${visit.photo_count} photos`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          )}
          {visit.status === 'completed' && visit.invoice && (
            <span className="mt-0.5">
              <InvoiceStatusBadge status={visit.invoice.status} withIcon />
            </span>
          )}
          {displayCrew.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {displayedCrew.map((emp) => (
                <span
                  key={emp.id}
                  className="text-[10px] bg-background/60 rounded px-1 leading-4 truncate max-w-[52px]"
                >
                  {emp.name.split(' ')[0]}
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-[10px] opacity-70 leading-4">+{overflow}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
