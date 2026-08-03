'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState, StaleNotice } from '@/components/states/ErrorState'
import type { SchedulePropertyRow } from '@/types/app'

function rowMatches(row: SchedulePropertyRow, filters: ScheduleFilters): boolean {
  if (filters.routeGroup !== 'all' && row.routeGroup.id !== filters.routeGroup) return false

  if (filters.crew !== 'all') {
    // Either relation counts: crew are routinely added to a visit only via the
    // completion form, so matching 'assigned' alone hid their finished work.
    const mine = (row.visit?.visit_crew ?? []).some(
      (vc) => vc.employee_id === filters.crew
    )
    if (!mine) return false
  }

  if (filters.status !== 'all') {
    // A row with no visit yet isn't in any status, so it's excluded when filtering by one.
    if (row.visit?.status !== filters.status) return false
  }

  return true
}

/** The body has exactly one of these five states at a time. */
type BodyView = 'loading' | 'error' | 'no-matches' | 'empty-week' | 'stops'

/**
 * Split out from the JSX so the precedence reads on its own: a first load beats
 * an error, cached stops beat an error (the stale-cache rule), and an empty
 * result means two different things depending on whether filters are hiding it.
 */
function resolveBodyView(input: {
  isLoading: boolean
  isError: boolean
  hasSchedule: boolean
  hasActiveFilters: boolean
  totalVisible: number
}): BodyView {
  if (input.isLoading && !input.hasSchedule) return 'loading'
  if (input.isError && !input.hasSchedule) return 'error'
  if (input.totalVisible > 0) return 'stops'
  return input.hasActiveFilters ? 'no-matches' : 'empty-week'
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

  // Opens on the whole week for everyone. "My stops" used to auto-apply, from
  // when it was this page's only filter; alongside the others it just read as an
  // empty schedule. Opt-in now.
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

  const { data: schedule, isLoading, isError, refetch } = useWeekSchedule(week)
  const { data: employees = [] } = useActiveEmployees()
  const { data: me } = useCurrentEmployee()

  // Stale-cache rule: a refresh failure never takes away stops crew already
  // have — cached data wins, the failure is annotated. See resolveBodyView.
  const showStaleNotice = isError && !!schedule

  const hasActiveFilters =
    filters.routeGroup !== EMPTY_FILTERS.routeGroup ||
    filters.crew !== EMPTY_FILTERS.crew ||
    filters.status !== EMPTY_FILTERS.status

  /** "My stops" is the only filter on — worth naming in the empty state, which
   *  then reads better than a generic "no stops match your filters". */
  const isMineOnly =
    !!me?.id &&
    filters.crew === me.id &&
    filters.routeGroup === EMPTY_FILTERS.routeGroup &&
    filters.status === EMPTY_FILTERS.status
  const canManage = me?.role === 'owner' || me?.role === 'lead'


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

  const bodyView = resolveBodyView({
    isLoading,
    isError,
    hasSchedule: !!schedule,
    hasActiveFilters,
    totalVisible,
  })

  const bodyViews: Record<BodyView, () => React.ReactNode> = {
    loading: () => (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    ),

    error: () => (
      <ErrorState
        title="The schedule didn't load."
        hint="You may be out of signal. Try again once you're back online."
        onRetry={() => refetch()}
      />
    ),

    // Filters are hiding the week — name which one and offer the undo.
    'no-matches': () => (
      <EmptyState
        variant="pruned"
        title={isMineOnly ? 'None of this week’s stops are yours' : 'No stops match your filters'}
        hint={
          isMineOnly
            ? 'Other crew may have stops this week.'
            : 'Clear them to see the whole week.'
        }
        action={
          <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
            {isMineOnly ? 'Show all stops' : 'Clear filters'}
          </Button>
        }
      />
    ),

    'empty-week': () => (
      <EmptyState
        variant="sprig"
        title="No stops this week"
        hint="Nothing is scheduled yet. Check another week, or ask an owner."
      />
    ),

    stops: () =>
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
      )),
  }

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
              setFilters({
                ...filters,
                status: filters.status === 'scheduled' ? 'all' : 'scheduled',
              })
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
              setFilters({
                ...filters,
                crew: filters.crew === me?.id ? 'all' : (me?.id ?? 'all'),
              })
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

      {showStaleNotice && <StaleNotice />}

      {/* Body */}
      <div className="p-4 space-y-4">{bodyViews[bodyView]()}</div>
    </div>
  )
}
