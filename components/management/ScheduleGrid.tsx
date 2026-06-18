'use client'

import { useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getWeekStart } from '@/lib/utils/schedule'
import { createVisit } from '@/app/management/schedule/actions'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import type {
  Employee,
  ScheduleWeek,
  ScheduleZoneRow,
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

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<ScheduleZoneRow | null>(null)
  const [sheetWeek, setSheetWeek] = useState('')
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Build visit lookup: zone_id → week_start → visit
  const visitMap = useMemo(() => {
    const map = new Map<string, Map<string, VisitWithCrew>>()
    for (const week of weeks) {
      for (const { rows } of week.routeGroups) {
        for (const row of rows) {
          if (!map.has(row.zone.id)) map.set(row.zone.id, new Map())
          if (row.visit) map.get(row.zone.id)!.set(week.weekStart, row.visit)
        }
      }
    }
    return map
  }, [weeks])

  function handleCellClick(row: ScheduleZoneRow, weekStart: string, visit: VisitWithCrew | null) {
    if (visit) {
      setSheetRow({ ...row, visit })
      setSheetWeek(weekStart)
      setSheetOpen(true)
    } else {
      const cellKey = `${row.zone.id}-${weekStart}`
      setCreatingKey(cellKey)
      startTransition(async () => {
        const res = await createVisit(row.zone.id, weekStart, row.account.id, row.property.id)
        setCreatingKey(null)
        if (res.error) {
          toast.error('Failed to create visit', { description: res.error })
        }
      })
    }
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    row: ScheduleZoneRow,
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
                    Zone / Property
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
                    {routeGroup.name}
                  </td>
                </tr>,
                ...rows.map((row) => (
                  <tr
                    key={`${routeGroup.id}-${row.zone.id}`}
                    className="border-b border-border/50 hover:bg-accent/20 transition-colors"
                  >
                    <td className="sticky left-0 bg-card z-10 border-r border-border px-4 py-3 min-w-[220px]">
                      <p className="font-medium text-foreground text-sm leading-tight">
                        {row.zone.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[190px]">
                        {row.property.address}
                      </p>
                    </td>
                    {weeks.map((week) => {
                      const visit = visitMap.get(row.zone.id)?.get(week.weekStart) ?? null
                      const cellKey = `${row.zone.id}-${week.weekStart}`
                      return (
                        <td key={week.weekStart} className="px-2 py-2 align-top">
                          <ScheduleCell
                            visit={visit}
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
    </>
  )
}

function ScheduleCell({
  visit,
  isCreating,
  onClick,
  onKeyDown,
}: {
  visit: VisitWithCrew | null
  isCreating: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        base,
        `status-${visit.status}`,
        'cursor-pointer hover:brightness-95',
        hasInstruction && 'border-l-4 border-[var(--clay)]',
      )}
    >
      <span className="text-xs font-medium capitalize leading-tight">{visit.status}</span>
      {visit.status === 'completed' && visit.actual_date && (
        <span className="text-[11px] opacity-80 tabular-nums">
          {format(parseISO(visit.actual_date), 'MMM d')}
        </span>
      )}
    </div>
  )
}
