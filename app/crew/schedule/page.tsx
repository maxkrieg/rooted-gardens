'use client'

import { useMemo, useState } from 'react'
import { addWeeks, format } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarRange, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScheduleStopRow } from '@/components/crew/ScheduleStopRow'
import {
  ScheduleFilterSheet,
  activeFilterChips,
  EMPTY_FILTERS,
  type ScheduleFilters,
} from '@/components/crew/CrewScheduleFilters'
import { useWeekSchedule } from '@/hooks/crew/useWeekSchedule'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { getWeekStart } from '@/lib/utils/schedule'
import type { ScheduleZoneRow } from '@/types/app'

function rowMatches(
  row: ScheduleZoneRow,
  filters: ScheduleFilters,
  myId: string | undefined
): boolean {
  if (filters.routeGroup !== 'all' && row.routeGroup.id !== filters.routeGroup) return false

  if (filters.crew !== 'all') {
    const targetId = filters.crew === 'me' ? myId : filters.crew
    if (!targetId) return false
    const assigned = (row.visit?.visit_crew ?? []).some(
      (vc) => vc.relation === 'assigned' && vc.employee_id === targetId
    )
    if (!assigned) return false
  }

  if (filters.status !== 'all') {
    // A row with no visit yet isn't in any status, so it's excluded when filtering by one.
    // Invoiced is treated as completed from the crew's perspective.
    const visitStatus = row.visit?.status
    const effectiveStatus = visitStatus === 'invoiced' ? 'completed' : visitStatus
    if (effectiveStatus !== filters.status) return false
  }

  const q = filters.search.trim().toLowerCase()
  if (q) {
    const hay = `${row.property.address} ${row.account.name}`.toLowerCase()
    if (!hay.includes(q)) return false
  }

  return true
}

export default function CrewSchedulePage() {
  const [week, setWeek] = useState(() => getWeekStart(new Date()))
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const thisWeek = getWeekStart(new Date())
  const isCurrentWeek = week.getTime() === thisWeek.getTime()

  const { data: schedule, isLoading } = useWeekSchedule(week)
  const { data: employees = [] } = useActiveEmployees()
  const { data: me } = useCurrentEmployee()

  const routeGroups = useMemo(
    () => schedule?.routeGroups.map((g) => g.routeGroup) ?? [],
    [schedule]
  )
  const chips = activeFilterChips(filters, employees, routeGroups)

  const filteredGroups = useMemo(() => {
    if (!schedule) return []
    return schedule.routeGroups
      .map((group) => ({
        routeGroup: group.routeGroup,
        rows: group.rows.filter((row) => rowMatches(row, filters, me?.id)),
      }))
      .filter((group) => group.rows.length > 0)
  }, [schedule, filters, me?.id])

  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.rows.length, 0)

  return (
    <div className="flex flex-col">
      {/* Header — week nav is the hero; filters live in a sheet */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[--border] px-4 py-3 space-y-2.5">
        {/* Row 1: title + week nav */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-semibold text-foreground">Schedule</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setWeek((w) => addWeeks(w, -1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground tabular-nums min-w-[64px] text-center">
              {format(week, 'MMM d')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setWeek((w) => addWeeks(w, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Row 2: quick toggles + Filters */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant={filters.crew === 'me' ? 'default' : 'outline'}
              size="sm"
              className="h-9 text-xs"
              onClick={() =>
                setFilters((f) => ({ ...f, crew: f.crew === 'me' ? 'all' : 'me' }))
              }
            >
              My stops
            </Button>
            {!isCurrentWeek && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setWeek(thisWeek)}
              >
                This week
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {chips.length > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[--primary] px-1 text-[10px] font-semibold text-[--primary-foreground] tabular-nums">
                {chips.length}
              </span>
            )}
          </Button>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, ...chip.clear }))}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground active:bg-accent transition-colors"
                aria-label={`Remove ${chip.key} filter`}
              >
                {chip.label}
                <X className="h-3 w-3 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {isLoading && !schedule ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : totalVisible === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-20 text-muted-foreground">
            <CalendarRange className="h-10 w-10 opacity-40" />
            <p className="text-sm">No stops match this week and filters.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.routeGroup.id}
              className="rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]"
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-b border-[--border]">
                <span className="text-sm font-semibold text-secondary-foreground">
                  {group.routeGroup.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.rows.length}
                </span>
              </div>
              <div className="divide-y divide-[--border]">
                {group.rows.map((row) => (
                  <ScheduleStopRow key={row.zone.id} row={row} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ScheduleFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        employees={employees}
        routeGroups={routeGroups}
      />
    </div>
  )
}
