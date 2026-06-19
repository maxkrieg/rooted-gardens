'use client'

import { useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { FilePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createVisit } from '@/app/management/schedule/actions'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VisitStatusBadge, FrequencyBadge } from '@/components/management/badges'
import type {
  Account,
  Employee,
  Property,
  RouteGroup,
  ScheduleWeek,
  ScheduleZoneRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

interface ScheduleListMobileProps {
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  canEdit: boolean
}

export function ScheduleListMobile({ weeks, employees, vehicles, canEdit }: ScheduleListMobileProps) {
  const week = weeks[0]

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<ScheduleZoneRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignGroup, setAssignGroup] = useState<RouteGroup | null>(null)

  function handleRowClick(row: ScheduleZoneRow, visit: VisitWithCrew | null) {
    if (visit) {
      setSheetRow({ ...row, visit })
      setSheetWeek(week.weekStart)
      setSheetOpen(true)
    } else {
      const cellKey = `${row.zone.id}-${week.weekStart}`
      setCreatingKey(cellKey)
      startTransition(async () => {
        const res = await createVisit(row.zone.id, week.weekStart, row.account.id, row.property.id)
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
        {week.routeGroups.map(({ routeGroup, rows }) => {
          const propertyGroups = rows.reduce<
            { property: Property; account: Account; rows: ScheduleZoneRow[] }[]
          >((acc, row) => {
            const last = acc[acc.length - 1]
            if (last && last.property.id === row.property.id) {
              last.rows.push(row)
            } else {
              acc.push({ property: row.property, account: row.account, rows: [row] })
            }
            return acc
          }, [])

          return (
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

              {/* Properties */}
              <div className="divide-y divide-border/50">
                {propertyGroups.map(({ property, account, rows: zoneRows }) => (
                  <div key={property.id}>
                    {/* Property header */}
                    <div className="px-4 py-2 border-l-2 border-l-primary/25 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground truncate">
                        {property.address}
                      </span>
                      {account.billing_type === 'contract' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] billing-contract border-transparent shrink-0 py-0 h-auto"
                        >
                          CONTRACT
                        </Badge>
                      )}
                    </div>

                    {/* Zone rows */}
                    <div className="divide-y divide-border/30">
                      {zoneRows.map((row) => {
                        const cellKey = `${row.zone.id}-${week.weekStart}`
                        const isCreating = creatingKey === cellKey
                        const assigned = row.visit
                          ? row.visit.visit_crew
                              .filter((vc) => vc.relation === 'assigned' && vc.employee)
                              .map((vc) => vc.employee!)
                          : []
                        const displayedCrew = assigned.slice(0, 2)
                        const overflow = assigned.length - 2

                        return (
                          <button
                            key={row.zone.id}
                            type="button"
                            disabled={isCreating}
                            onClick={() => handleRowClick(row, row.visit)}
                            className={cn(
                              'w-full text-left px-4 pl-8 py-3 min-h-[56px]',
                              'flex items-center justify-between gap-3',
                              'border-l-2 border-l-primary/10',
                              'hover:bg-accent/20 active:bg-accent/30 transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                              isCreating && 'opacity-50 cursor-wait',
                            )}
                          >
                            {/* Left: zone name + frequency */}
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-sm font-medium text-foreground leading-tight truncate">
                                {row.zone.name}
                              </span>
                              <FrequencyBadge frequency={row.zone.frequency} />
                            </div>

                            {/* Right: crew + instruction + status */}
                            <div className="flex items-center gap-2 shrink-0">
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
                                <VisitStatusBadge status={row.visit.status} />
                              ) : (
                                <span className="text-xs text-muted-foreground/50">
                                  {isCreating ? '…' : '+ Schedule'}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          row={sheetRow}
          weekStart={sheetWeek}
          employees={employees}
          vehicles={vehicles}
          canEdit={canEdit}
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
