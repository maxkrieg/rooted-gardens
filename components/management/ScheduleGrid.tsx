'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getWeekStart } from '@/lib/utils/schedule'
import { createVisit } from '@/app/management/schedule/actions'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { RouteAssignDialog } from '@/components/management/RouteAssignDialog'
import { useVisitTimings } from '@/components/management/SessionsProvider'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilePen } from 'lucide-react'
import { FrequencyBadge } from '@/components/management/badges'
import type {
  Employee,
  RouteGroup,
  ScheduleWeek,
  SchedulePropertyRow,
  Vehicle,
  VisitWithCrew,
} from '@/types/app'

interface ScheduleGridProps {
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
  canEdit: boolean
}

export function ScheduleGrid({ weeks, employees, vehicles, canEdit }: ScheduleGridProps) {
  const currentWeekStart = useMemo(
    () => format(getWeekStart(new Date()), 'yyyy-MM-dd'),
    []
  )
  const visitTimings = useVisitTimings()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<SchedulePropertyRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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
    }
    return map
  }, [weeks])

  function handleCellClick(row: SchedulePropertyRow, weekStart: string, visit: VisitWithCrew | null) {
    if (visit) {
      setSheetRow({ ...row, visit })
      setSheetWeek(weekStart)
      setSheetOpen(true)
    } else {
      const cellKey = `${row.property.id}-${weekStart}`
      setCreatingKey(cellKey)
      startTransition(async () => {
        const res = await createVisit(row.property.id, weekStart, row.account.id)
        setCreatingKey(null)
        if (res.error) {
          toast.error('Failed to create visit', { description: res.error })
        }
      })
    }
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    row: SchedulePropertyRow,
    weekStart: string,
    visit: VisitWithCrew | null,
  ) {
    if ((e.key === 's' || e.key === 'S') && !visit) {
      e.preventDefault()
      handleCellClick(row, weekStart, null)
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCellClick(row, weekStart, visit)
    }
  }

  if (weeks.length === 0 || weeks[0].routeGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-12 text-center">
        <p className="text-muted-foreground">
          No route groups configured. Add properties to a route group to see the schedule.
        </p>
      </div>
    )
  }

  const structure = weeks[0]

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-warm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-card border-b border-border">
              <tr>
                <th className="sticky left-0 z-30 bg-card border-r border-border px-4 py-3 text-left min-w-[220px]">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Property
                  </span>
                </th>
                {weeks.map((week) => {
                  const isCurrent = week.weekStart === currentWeekStart
                  return (
                    <th
                      key={week.weekStart}
                      className={cn(
                        'min-w-[140px] px-3 py-3 text-center',
                        isCurrent ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <div className={cn('text-sm', isCurrent ? 'font-bold' : 'font-semibold')}>
                        {format(parseISO(week.weekStart), 'MMM d')}
                      </div>
                      {isCurrent && (
                        <div className="text-[10px] font-medium text-primary/70 mt-0.5">
                          This week
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {structure.routeGroups.flatMap(({ routeGroup, rows }) => [
                <tr key={`rg-${routeGroup.id}`}>
                  <td
                    colSpan={1 + weeks.length}
                    className="bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-widest px-4 py-2 border-b border-border"
                  >
                    <div className="flex items-center justify-between">
                      <span>{routeGroup.name}</span>
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
                  </td>
                </tr>,
                ...rows.map((row) => (
                  <tr
                    key={`${routeGroup.id}-${row.property.id}`}
                    className="group border-b border-border/50 hover:bg-accent/20 transition-colors"
                  >
                    <td className="sticky left-0 bg-card z-10 border-r border-border border-l-2 border-l-primary/25 px-4 py-3 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm leading-tight truncate max-w-[140px]">
                          {row.property.address}
                        </span>
                        {row.account.billing_type === 'contract' && (
                          <Badge variant="outline" className="text-[10px] billing-contract border-transparent shrink-0 py-0 h-auto">
                            CONTRACT
                          </Badge>
                        )}
                        {row.account.billing_type === 'per_visit' && row.account.price_per_visit && (
                          <span className="text-[10px] text-transparent group-hover:text-muted-foreground transition-colors shrink-0">
                            ${row.account.price_per_visit}/visit
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        <FrequencyBadge frequency={row.property.frequency} />
                      </div>
                    </td>
                    {weeks.map((week) => {
                      const visit = visitMap.get(row.property.id)?.get(week.weekStart) ?? null
                      const cellKey = `${row.property.id}-${week.weekStart}`
                      // Merge live realtime overlay with server-fetched visit timing
                      const overlay = visit ? visitTimings.get(visit.id) : undefined
                      const effectiveStartedAt =
                        overlay !== undefined ? overlay.started_at : (visit?.started_at ?? null)
                      const effectiveEndedAt =
                        overlay !== undefined ? overlay.ended_at : (visit?.ended_at ?? null)
                      const inProgress = visit
                        ? isVisitInProgress({ started_at: effectiveStartedAt, ended_at: effectiveEndedAt })
                        : false
                      return (
                        <td key={week.weekStart} className="px-2 py-2 align-top">
                          <ScheduleCell
                            visit={visit}
                            inProgress={inProgress}
                            startedAt={effectiveStartedAt}
                            isCreating={creatingKey === cellKey}
                            onClick={() => handleCellClick(row, week.weekStart, visit)}
                            onKeyDown={(e) => handleCellKeyDown(e, row, week.weekStart, visit)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
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

  const assignedCrew = visit.visit_crew
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => vc.employee!)
  const displayedCrew = assignedCrew.slice(0, 2)
  const overflow = assignedCrew.length - 2

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
          <span className="text-xs font-medium capitalize leading-tight">{visit.status}</span>
          {visit.status === 'completed' && visit.ended_at && (
            <span className="text-[11px] opacity-80 tabular-nums">
              {format(parseISO(visit.ended_at), 'MMM d')}
            </span>
          )}
          {assignedCrew.length > 0 && (
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
