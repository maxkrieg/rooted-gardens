'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { ChevronRight, FilePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCan } from '@/components/app/RoleProvider'
import { useCreateVisit } from '@/hooks/useCreateVisit'
import { toUserMessage } from '@/lib/errors'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { ScheduleEmptyState } from '@/components/management/ScheduleEmptyState'
import { useVisitOverlays } from '@/components/management/SessionsProvider'
import { isVisitInProgress, formatElapsed, mergeVisitOverlay } from '@/lib/utils/visits'
import { groupRowsByAccount } from '@/lib/utils/schedule'
import { syncVisitUrlParam } from '@/lib/utils/visit-url'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { Button } from '@/components/ui/button'
import {
  AccountPriceMeta,
  VisitStatusBadge,
  FrequencyBadge,
  BillingTypeBadge,
  InvoiceStatusBadge,
} from '@/components/management/badges'
import type {
  Account,
  Employee,
  EmployeeRole,
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
}

export function ScheduleListMobile({
  week,
  windowWeeks,
  employees,
  vehicles,
  filtered,
}: ScheduleListMobileProps) {
  const { editSchedule: canEdit } = useCan()
  const visitOverlays = useVisitOverlays()
  const createVisit = useCreateVisit()

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

  // Renders one stop button. Shared by both label shapes so the right-side
  // status/crew/on-site content can never drift between them:
  //   - `merged` — the ~99% case: one account with one property. Account
  //     name, address, and frequency/price all live in this one button.
  //   - `nested` — a property row under a multi-property account header.
  //     Only these carry the sage rail — it means "a site of the account
  //     above," not "this is a property row."
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
    const visit = base ? mergeVisitOverlay(base, visitOverlays) : null
    const effectiveStartedAt = visit?.started_at ?? null
    const inProgress = visit ? isVisitInProgress(visit) : false
    // Once a visit is completed, show who actually did the work rather than
    // who was planned — falls back to assigned crew if no completion crew
    // was recorded.
    const assigned = visit
      ? visit.visit_crew
          .filter((vc) => vc.relation === 'assigned' && vc.employee)
          .map((vc) => vc.employee!)
      : []
    const completed = visit
      ? visit.visit_crew
          .filter((vc) => vc.relation === 'completed' && vc.employee)
          .map((vc) => vc.employee!)
      : []
    const displayCrew = visit?.status === 'completed' && completed.length > 0 ? completed : assigned
    const displayedCrew = displayCrew.slice(0, 2)
    const overflow = displayCrew.length - 2

    return (
      <button
        key={row.property.id}
        type="button"
        disabled={isCreating}
        onClick={() => handleRowClick(row, visit)}
        className={cn(
          'w-full text-left py-3 min-h-[56px]',
          'flex items-center justify-between gap-3',
          isNested ? 'border-l-2 border-l-primary/25 pl-7 pr-4' : 'px-5',
          showTopBorder && 'border-t border-border/50',
          'hover:bg-accent/20 active:bg-accent/30 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isCreating && 'opacity-50 cursor-wait',
        )}
      >
        {/* Left: identity */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {!isNested && (
            <span className="font-display text-[15px] font-semibold leading-snug text-foreground truncate">
              {account.name}
            </span>
          )}
          <span className="text-[13px] leading-snug text-muted-foreground truncate">
            {row.property.address}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <FrequencyBadge frequency={row.property.frequency} />
            {!isNested && <AccountPriceMeta account={account} />}
          </div>
        </div>

        {/* Right: on-site indicator or crew + status */}
        <div className="flex items-center gap-2 shrink-0">
          {inProgress && effectiveStartedAt ? (
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--clay)]/10 border border-[var(--clay)]/30 px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
              <span className="text-[11px] font-semibold text-[var(--clay)]">On site</span>
              <span className="text-[11px] text-[var(--clay)]/70 tabular-nums">
                {formatElapsed(effectiveStartedAt)}
              </span>
            </div>
          ) : (
            <>
              {displayedCrew.length > 0 && (
                <div className="flex gap-0.5">
                  {displayedCrew.map((emp) => (
                    <span key={emp.id} className="text-[10px] bg-muted/60 rounded px-1 leading-5">
                      {emp.name.split(' ')[0]}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] text-muted-foreground leading-5">+{overflow}</span>
                  )}
                </div>
              )}

              {visit?.crew_instruction && (
                <FilePen className="w-4 h-4 text-[var(--clay)] shrink-0" />
              )}

              {visit ? (
                <div className="flex flex-col items-end gap-1">
                  <VisitStatusBadge status={visit.status} />
                  {visit.status === 'completed' && visit.invoice && (
                    <InvoiceStatusBadge status={visit.invoice.status} withIcon />
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/50">
                  {isCreating ? '…' : '+ Schedule'}
                </span>
              )}
            </>
          )}
        </div>
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
    const price = formatAccountPrice(account)
    return (
      <div className={cn('px-5 pt-2.5 pb-1.5', showTopBorder && 'border-t border-border/60')}>
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
      </div>
    )
  }

  return (
    <>
      <Link
        href={`/app/schedule?week=${currentWeek.weekStart}`}
        className="inline-flex items-center gap-1 mb-4 text-sm text-muted-foreground tabular-nums hover:text-foreground hover:underline"
      >
        {format(parseISO(currentWeek.weekStart), 'MMM d')} –{' '}
        {format(addDays(parseISO(currentWeek.weekStart), 6), 'MMM d')}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      <div className="space-y-4">
        {currentWeek.routeGroups.map(({ routeGroup, rows }) => (
          <div
            key={routeGroup.id}
            className="rounded-xl border border-border bg-card shadow-warm overflow-hidden"
          >
            {/* Route group header */}
            <div className="bg-secondary text-secondary-foreground flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-widest">
                {routeGroup.name}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 text-xs font-medium text-secondary-foreground/70 hover:text-foreground hover:bg-secondary-foreground/10 normal-case tracking-normal"
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

            {/* Properties, nested by account */}
            <div>
              {groupRowsByAccount(rows).map(({ account, rows: acctRows }, acctIdx) => {
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
          <div className="rounded-xl border border-[var(--clay)]/30 bg-card shadow-warm overflow-hidden">
            {/* "Not on a route" — properties with no property_route_groups row.
                These used to be silently dropped from the schedule entirely. */}
            <div className="bg-[var(--clay)]/10 text-[var(--clay)] flex items-center justify-between px-4 py-2.5 border-b border-[var(--clay)]/30">
              <span className="text-xs font-semibold uppercase tracking-widest">
                Not on a route · {currentWeek.ungrouped.length}
              </span>
              <Link
                href="/app/routes"
                className="px-2 text-xs font-medium normal-case tracking-normal text-[var(--clay)]/80 hover:text-[var(--clay)]"
              >
                Put on a route →
              </Link>
            </div>
            <div>
              {groupRowsByAccount(currentWeek.ungrouped).map(({ account, rows: acctRows }, acctIdx) => {
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

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          row={sheetRow}
          weekStart={sheetWeek}
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
