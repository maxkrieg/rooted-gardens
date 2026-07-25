'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { addDays, addWeeks, format } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarRange, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScheduleStopRow } from '@/components/crew/ScheduleStopRow'
import {
  CrewScheduleFilterBar,
  EMPTY_FILTERS,
  type ScheduleFilters,
} from '@/components/crew/CrewScheduleFilters'
import { useWeekSchedule } from '@/hooks/crew/useWeekSchedule'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { formatWeekParam, getWeekStart, parseWeekParam } from '@/lib/utils/schedule'
import type { SchedulePropertyRow } from '@/types/app'

function rowMatches(row: SchedulePropertyRow, filters: ScheduleFilters): boolean {
  if (filters.routeGroup !== 'all' && row.routeGroup.id !== filters.routeGroup) return false

  if (filters.crew !== 'all') {
    const assigned = (row.visit?.visit_crew ?? []).some(
      (vc) => vc.relation === 'assigned' && vc.employee_id === filters.crew
    )
    if (!assigned) return false
  }

  if (filters.status !== 'all') {
    // A row with no visit yet isn't in any status, so it's excluded when filtering by one.
    if (row.visit?.status !== filters.status) return false
  }

  return true
}

export default function CrewSchedulePageRoute() {
  return (
    <Suspense fallback={null}>
      <CrewSchedulePage />
    </Suspense>
  )
}

function CrewSchedulePage() {
  const searchParams = useSearchParams()
  // The `?week=` param seeds the initial week (deep links from the management
  // schedule). After that the week lives in state and the URL is kept in sync with
  // history.replaceState — a router navigation would be a network round-trip, and
  // crew are frequently offline.
  const [week, setWeek] = useState(() => parseWeekParam(searchParams.get('week')))
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS)

  const thisWeek = getWeekStart(new Date())
  const isCurrentWeek = week.getTime() === thisWeek.getTime()

  const changeWeek = useCallback((next: Date) => {
    const resolved = getWeekStart(next)
    setWeek(resolved)
    const url = new URL(window.location.href)
    url.searchParams.set('week', formatWeekParam(resolved))
    window.history.replaceState(null, '', url)
  }, [])

  const { data: schedule, isLoading } = useWeekSchedule(week)
  const { data: employees = [] } = useActiveEmployees()
  const { data: me } = useCurrentEmployee()
  const canManage = me?.role === 'owner' || me?.role === 'lead'

  // Default to the current user's own stops ("My stops") once their employee record
  // loads — done here rather than in the initial state because `me` is fetched async.
  const didInitCrew = useRef(false)
  useEffect(() => {
    if (!didInitCrew.current && me?.id) {
      didInitCrew.current = true
      setFilters((f) => ({ ...f, crew: me.id }))
    }
  }, [me?.id])

  const routeGroups = useMemo(
    () => schedule?.routeGroups.map((g) => g.routeGroup) ?? [],
    [schedule]
  )

  const filteredGroups = useMemo(() => {
    if (!schedule) return []
    return schedule.routeGroups
      .map((group) => ({
        routeGroup: group.routeGroup,
        rows: group.rows.filter((row) => rowMatches(row, filters)),
      }))
      .filter((group) => group.rows.length > 0)
  }, [schedule, filters])

  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.rows.length, 0)

  return (
    <div className="flex flex-col">
      {/* Header — week nav is the hero; filters sit inline across the top */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[--border] px-4 py-3 space-y-2.5">
        {/* Row 1: title + week nav */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-xl font-semibold text-foreground">Schedule</h1>
            {canManage && (
              <Link
                href={`/management/schedule?week=${formatWeekParam(week)}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[--border] bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent hover:text-[--accent-foreground]"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Manage
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => changeWeek(addWeeks(week, -1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground tabular-nums min-w-[112px] text-center">
              {format(week, 'MMM d')} – {format(addDays(week, 6), 'MMM d')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => changeWeek(addWeeks(week, 1))}
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Row 2: quick toggles */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={filters.status === 'scheduled' ? 'default' : 'outline'}
            size="sm"
            className="h-9 text-xs"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                status: f.status === 'scheduled' ? 'all' : 'scheduled',
              }))
            }
          >
            Incomplete
          </Button>
          <Button
            variant={me?.id && filters.crew === me.id ? 'default' : 'outline'}
            size="sm"
            className="h-9 text-xs"
            disabled={!me?.id}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                crew: f.crew === me?.id ? 'all' : (me?.id ?? 'all'),
              }))
            }
          >
            My stops
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => changeWeek(thisWeek)}
            >
              This week
            </Button>
          )}
        </div>

        {/* Row 3: route + crew dropdowns */}
        <CrewScheduleFilterBar
          filters={filters}
          onChange={setFilters}
          employees={employees}
          routeGroups={routeGroups}
          currentEmployeeId={me?.id}
        />
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
                  <ScheduleStopRow key={row.property.id} row={row} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
