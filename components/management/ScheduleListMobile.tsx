'use client'

import { useEffect, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { FilePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createVisit } from '@/app/management/schedule/actions'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { useVisitTimings } from '@/components/management/SessionsProvider'
import { isVisitInProgress, isVisitMissed, formatElapsed } from '@/lib/utils/visits'
import { groupRowsByAccount } from '@/lib/utils/schedule'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { Button } from '@/components/ui/button'
import { VisitStatusBadge, FrequencyBadge, BillingTypeBadge } from '@/components/management/badges'
import type {
  Employee,
  EmployeeRole,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

interface ScheduleListMobileProps {
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  canEdit: boolean
  role: EmployeeRole | undefined
}

export function ScheduleListMobile({ weeks, employees, vehicles, canEdit, role }: ScheduleListMobileProps) {
  const week = weeks[0]
  const visitTimings = useVisitTimings()

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
  const [, startTransition] = useTransition()

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroup, setAssignGroup] = useState<RouteGroup | null>(null)

  function handleRowClick(row: SchedulePropertyRow, visit: VisitWithCrew | null) {
    if (visit) {
      setSheetRow({ ...row, visit })
      setSheetWeek(week.weekStart)
      setSheetOpen(true)
    } else {
      const cellKey = `${row.property.id}-${week.weekStart}`
      setCreatingKey(cellKey)
      startTransition(async () => {
        const res = await createVisit(row.property.id, week.weekStart, row.account.id)
        setCreatingKey(null)
        if (res.error) {
          toast.error('Failed to create visit', { description: res.error })
        }
      })
    }
  }

  if (!week || week.routeGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-12 text-center">
        <p className="text-muted-foreground">
          No route groups configured. Add properties to a route group to see the schedule.
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Week of {format(parseISO(week.weekStart), 'MMMM d, yyyy')}
      </p>

      <div className="space-y-4">
        {week.routeGroups.map(({ routeGroup, rows }) => (
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
                  className="h-6 px-2 text-xs font-medium text-secondary-foreground/70 hover:text-foreground hover:bg-secondary-foreground/10 normal-case tracking-normal"
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
              {groupRowsByAccount(rows).map(({ account, rows: acctRows }, acctIdx) => (
                <div key={account.id}>
                  {/* Account header — subordinate to the route-group header above:
                      a thin rule (no fill) with the account name in Fraunces, breaking
                      from the route header's all-caps sans, plus the billing rate. */}
                  <div
                    className={cn(
                      'flex items-baseline gap-2 px-5 pt-2.5 pb-1.5',
                      acctIdx > 0 && 'border-t border-border/60',
                    )}
                  >
                    <span className="font-display text-sm text-foreground truncate min-w-0">
                      {account.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {formatAccountPrice(account)}
                    </span>
                    <BillingTypeBadge billingType={account.billing_type} />
                  </div>

                  {acctRows.map((row, rowIdx) => {
                    const cellKey = `${row.property.id}-${week.weekStart}`
                    const isCreating = creatingKey === cellKey
                    // Merge live realtime overlay with server-fetched visit timing
                    const overlay = row.visit ? visitTimings.get(row.visit.id) : undefined
                    const effectiveStartedAt =
                      overlay !== undefined ? overlay.started_at : (row.visit?.started_at ?? null)
                    const effectiveEndedAt =
                      overlay !== undefined ? overlay.ended_at : (row.visit?.ended_at ?? null)
                    const inProgress = row.visit
                      ? isVisitInProgress({ started_at: effectiveStartedAt, ended_at: effectiveEndedAt })
                      : false
                    // Once a visit is completed, show who actually did the work rather
                    // than who was planned — falls back to assigned crew if no
                    // completion crew was recorded.
                    const assigned = row.visit
                      ? row.visit.visit_crew
                          .filter((vc) => vc.relation === 'assigned' && vc.employee)
                          .map((vc) => vc.employee!)
                      : []
                    const completed = row.visit
                      ? row.visit.visit_crew
                          .filter((vc) => vc.relation === 'completed' && vc.employee)
                          .map((vc) => vc.employee!)
                      : []
                    const displayCrew =
                      row.visit?.status === 'completed' && completed.length > 0 ? completed : assigned
                    const displayedCrew = displayCrew.slice(0, 2)
                    const overflow = displayCrew.length - 2

                    return (
                      <button
                        key={row.property.id}
                        type="button"
                        disabled={isCreating}
                        onClick={() => handleRowClick(row, row.visit)}
                        className={cn(
                          'w-full text-left pl-7 pr-4 py-3 min-h-[56px]',
                          'flex items-center justify-between gap-3',
                          'border-l-2 border-l-primary/25',
                          rowIdx > 0 && 'border-t border-border/50',
                          'hover:bg-accent/20 active:bg-accent/30 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          isCreating && 'opacity-50 cursor-wait',
                        )}
                      >
                        {/* Left: address + frequency */}
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium text-foreground leading-tight truncate">
                            {row.property.address}
                          </span>
                          <FrequencyBadge frequency={row.property.frequency} />
                        </div>

                        {/* Right: on-site indicator or crew + status */}
                        <div className="flex items-center gap-2 shrink-0">
                          {inProgress && effectiveStartedAt ? (
                            <div className="flex items-center gap-1.5 rounded-full bg-[var(--clay)]/10 border border-[var(--clay)]/30 px-2.5 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
                              <span className="text-[11px] font-semibold text-[var(--clay)]">
                                On site
                              </span>
                              <span className="text-[11px] text-[var(--clay)]/70 tabular-nums">
                                {formatElapsed(effectiveStartedAt)}
                              </span>
                            </div>
                          ) : (
                            <>
                              {displayedCrew.length > 0 && (
                                <div className="flex gap-0.5">
                                  {displayedCrew.map((emp) => (
                                    <span
                                      key={emp.id}
                                      className="text-[10px] bg-muted/60 rounded px-1 leading-5"
                                    >
                                      {emp.name.split(' ')[0]}
                                    </span>
                                  ))}
                                  {overflow > 0 && (
                                    <span className="text-[10px] text-muted-foreground leading-5">
                                      +{overflow}
                                    </span>
                                  )}
                                </div>
                              )}

                              {row.visit?.crew_instruction && (
                                <FilePen className="w-4 h-4 text-[var(--clay)] shrink-0" />
                              )}

                              {row.visit ? (
                                <VisitStatusBadge
                                  status={row.visit.status}
                                  missed={isVisitMissed(row.visit)}
                                />
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
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
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
