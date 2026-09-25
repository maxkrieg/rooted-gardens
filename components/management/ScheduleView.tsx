'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { addWeeks, format } from 'date-fns'
import { getWeekStart, parseWeekParam } from '@/lib/utils/schedule'
import {
  activeScheduleFilterCount,
  filterScheduleWeeks,
  hasActiveScheduleFilters,
  scheduleFilterParams,
  type ScheduleFilterValues,
} from '@/lib/utils/schedule-filters'
import { useManagementSchedule, usePrefetchWeeks } from '@/hooks/useManagementSchedule'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { useActiveVehicles } from '@/hooks/crew/useActiveVehicles'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useIsHydrated } from '@/hooks/use-hydrated'
import { useCan } from '@/components/app/RoleProvider'
import {
  DEFAULT_SCHEDULE_SORT,
  SCHEDULE_SORT_KEY,
  parseScheduleSortState,
  setAllSortMode,
  setGroupSortMode,
  type ScheduleSortMode,
  type ScheduleSortState,
} from '@/lib/utils/schedule-sort'
import { ScheduleSortToggle } from '@/components/management/ScheduleSortToggle'
import { ScheduleGrid } from '@/components/management/ScheduleGrid'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { ScheduleNav } from '@/components/management/ScheduleNav'
import { Button } from '@/components/ui/button'
import { ScheduleFilterBar } from '@/components/management/ScheduleFilterBar'
import { ScheduleFilterSheet } from '@/components/management/ScheduleFilterSheet'
import { ScheduleHeaderMobile } from '@/components/management/ScheduleHeaderMobile'
import { DashboardView } from '@/components/management/DashboardView'
import { GenerateWeekSheet } from '@/components/management/GenerateWeekSheet'
import { useWeekPlan, useGenerateWeek } from '@/hooks/useGenerateWeek'
import { ScheduleRealtime } from '@/components/management/ScheduleRealtime'
import { DeepLinkedVisitSheet } from '@/components/management/DeepLinkedVisitSheet'
import { CachedNotice } from '@/components/states/CachedNotice'
import { ErrorState } from '@/components/states/ErrorState'
import type { Account } from '@/types/app'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ScheduleViewProps {
  initialWeek: string
  initialFilters: ScheduleFilterValues
  initialVisitId: string | undefined
  /** `?view=` when the URL names one — the old /app/dashboard redirect does.
   *  null means "no instruction", and the stored preference decides. */
  initialViewMode: ScheduleViewMode | null
}

const VIEW_MODE_KEY = 'rg-schedule-view'

/** Client-first schedule. Week and filters live in state, mirrored to the URL for sharing. */
export function ScheduleView({
  initialWeek,
  initialFilters,
  initialVisitId,
  initialViewMode,
}: ScheduleViewProps) {
  const [windowStart, setWindowStart] = useState(initialWeek)
  const [filters, setFilters] = useState<ScheduleFilterValues>(initialFilters)
  // Must match the `lg:` breakpoint the layouts switch on, or a phone fetches weeks it never
  // renders.
  const isWide = useMediaQuery('(min-width: 1024px)')
  const weekCount = isWide ? 4 : 1
  const hydrated = useIsHydrated()
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [viewOverride, setViewOverride] = useState<ScheduleViewMode | null>(null)
  const [sortOverride, setSortOverride] = useState<ScheduleSortState | null>(null)
  const { editSchedule: canEdit, seeDashboard } = useCan()

  // Resolved, not stored: localStorage doesn't exist on the server. Precedence: tap → ?view= →
  // last used → Week.
  const storedViewMode = useMemo<ScheduleViewMode | null>(() => {
    if (!hydrated) return null
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY)
      return stored === 'today' || stored === 'week' ? stored : null
    } catch {
      return null
    }
  }, [hydrated])

  // Crew get no Today view: it carries company-wide stats.
  const requested = viewOverride ?? initialViewMode ?? storedViewMode ?? 'week'
  const viewMode: ScheduleViewMode = seeDashboard ? requested : 'week'

  function changeViewMode(next: ScheduleViewMode) {
    setViewOverride(next)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // Private mode or blocked storage — the choice just doesn't persist.
    }
  }

  // Resolved like the view mode. Defaults to drive order; priority is the planning override.
  const storedSort = useMemo<ScheduleSortState | null>(() => {
    if (!hydrated) return null
    try {
      return parseScheduleSortState(window.localStorage.getItem(SCHEDULE_SORT_KEY))
    } catch {
      return null
    }
  }, [hydrated])

  const sortState: ScheduleSortState = sortOverride ?? storedSort ?? DEFAULT_SCHEDULE_SORT

  function persistSort(next: ScheduleSortState) {
    setSortOverride(next)
    try {
      window.localStorage.setItem(SCHEDULE_SORT_KEY, JSON.stringify(next))
    } catch {
      // Private mode or blocked storage — the choice just doesn't persist.
    }
  }

  const changeAllSort = (mode: ScheduleSortMode) => persistSort(setAllSortMode(mode))
  const changeGroupSort = (groupKey: string, mode: ScheduleSortMode) =>
    persistSort(setGroupSortMode(sortState, groupKey, mode))

  const weekStarts = useMemo(() => {
    const base = parseWeekParam(windowStart)
    return Array.from({ length: weekCount }, (_, n) => format(addWeeks(base, n), 'yyyy-MM-dd'))
  }, [windowStart, weekCount])

  const { weeks, isLoading, isError, isStale, hasData } = useManagementSchedule(weekStarts)
  const prefetchWeeks = usePrefetchWeeks()
  const { data: employees = [] } = useActiveEmployees()
  const { data: vehicles = [] } = useActiveVehicles()

  // Warm the neighbours so paging a week works in a dead zone.
  useEffect(() => {
    const base = parseWeekParam(windowStart)
    prefetchWeeks([
      format(addWeeks(base, -1), 'yyyy-MM-dd'),
      format(addWeeks(base, weekCount), 'yyyy-MM-dd'),
    ])
  }, [windowStart, weekCount, prefetchWeeks])

  // Shareable URL without a router navigation — the round-trip is what breaks
  // offline. Same reasoning as syncVisitUrlParam and the crew schedule page.
  useEffect(() => {
    const params = scheduleFilterParams(filters, windowStart)
    window.history.replaceState(null, '', `/app/schedule?${params.toString()}`)
  }, [filters, windowStart])

  const filtered = hasActiveScheduleFilters(filters)

  // Options come from the unfiltered window so they never collapse as filters narrow.
  const routeGroupOptions = weeks[0]?.routeGroups.map((g) => g.routeGroup) ?? []
  const accountOptions = useMemo(
    () =>
      dedupeAccounts(
        weeks.flatMap((w) => [
          ...w.routeGroups.flatMap((g) => g.rows.map((r) => r.account)),
          ...w.ungrouped.map((r) => r.account),
        ]),
      ),
    [weeks],
  )

  const visitIds = useMemo(
    () =>
      weeks
        .flatMap((w) => [
          ...w.routeGroups.flatMap((rg) => rg.rows.map((r) => r.visit?.id)),
          ...w.ungrouped.map((r) => r.visit?.id),
        ])
        .filter((id): id is string => Boolean(id)),
    [weeks],
  )

  // Planned against the *unfiltered* week: generating off a filtered view would
  // silently skip everything the filter hid.
  const plan = useWeekPlan(windowStart, weeks[0])
  const generateWeek = useGenerateWeek(windowStart)

  const gridWeeks = useMemo(() => filterScheduleWeeks(weeks, filters), [weeks, filters])
  const mobileWeek = useMemo(
    () => filterScheduleWeeks(weeks.slice(0, 1), filters)[0],
    [weeks, filters],
  )

  function goToWeek(next: string) {
    setWindowStart(format(getWeekStart(parseWeekParam(next)), 'yyyy-MM-dd'))
  }

  // The server has no React Query cache, so it can only ever render the skeleton.
  // Rendering anything else here is a guaranteed hydration mismatch.
  if (!hydrated || (isLoading && !hasData)) return <ScheduleSkeleton />
  if (isError && !hasData) {
    return <ErrorState title="The schedule didn't load." hint="Check your connection, then try again." />
  }

  // The phone list renders one week, so its match count is that week's rows.
  const mobileMatchCount =
    (mobileWeek?.routeGroups.reduce((sum, g) => sum + g.rows.length, 0) ?? 0) +
    (mobileWeek?.ungrouped.length ?? 0)

  return (
    <div>
      {/* No <h1>: the nav tab already says Schedule, and on a phone that line
          cost more vertical space than anything else on the screen. */}
      <ScheduleStickyBar>
        <div className="lg:hidden">
          <ScheduleHeaderMobile
            weekStart={windowStart}
            onWeekChange={goToWeek}
            activeFilterCount={activeScheduleFilterCount(filters)}
            onOpenFilters={() => setFilterSheetOpen(true)}
            overflowActions={
              canEdit
                ? [
                    { label: 'Generate week…', onClick: () => setGenerateOpen(true) },
                    {
                      label: selectMode ? 'Done selecting' : 'Select stops',
                      onClick: () => setSelectMode((on) => !on),
                    },
                  ]
                : []
            }
          />
        </div>
        <div className="hidden flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:flex">
          <ScheduleFilterBar
            filters={filters}
            routeGroups={routeGroupOptions}
            accounts={accountOptions}
            employees={employees}
            onChange={setFilters}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {/* The phone keeps these in its header's ⋯; a laptop has the room
                to show them outright. Generate works on the leftmost week. */}
            {canEdit && viewMode !== 'today' && (
              <>
                <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setGenerateOpen(true)}>
                  Generate week…
                </Button>
                <Button
                  variant={selectMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setSelectMode((on) => !on)}
                >
                  {selectMode ? 'Done selecting' : 'Select stops'}
                </Button>
              </>
            )}
            <ScheduleNav windowStart={windowStart} onWeekChange={goToWeek} />
          </div>
        </div>
      </ScheduleStickyBar>

      {/* Under the sticky bar so it scrolls away; the header row has no room left. */}
      {(seeDashboard || viewMode !== 'today') && (
        <div className="mb-2 flex items-center gap-2 lg:mb-3">
          {seeDashboard && (
            <div className="max-w-xs flex-1">
              <ScheduleViewToggle value={viewMode} onChange={changeViewMode} />
            </div>
          )}
          {viewMode !== 'today' && (
            <ScheduleSortToggle
              mode={sortState.all}
              onChange={changeAllSort}
              scope="Every route"
              className="ml-auto"
            />
          )}
        </div>
      )}

      <GenerateWeekSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        weekStart={windowStart}
        decisions={plan.decisions}
        isLoading={plan.isLoading}
        isError={plan.isError}
        onConfirm={generateWeek}
      />

      <ScheduleFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        routeGroups={routeGroupOptions}
        accounts={accountOptions}
        employees={employees}
        onChange={setFilters}
        matchCount={mobileMatchCount}
      />

      {isStale && <CachedNotice />}

      {viewMode === 'today' && <DashboardView />}

      {/* Kept mounted, not unmounted, when Today is showing: DeepLinkedVisitSheet
          lives in here and a ?visit= link must still open its sheet. */}
      <div className={viewMode === 'today' ? 'hidden' : undefined}>
      <ScheduleRealtime visitIds={visitIds} />
        <div className="hidden lg:block">
          <ScheduleGrid
            weeks={gridWeeks}
            employees={employees}
            vehicles={vehicles}
            filtered={filtered}
            selectMode={selectMode && isWide}
            onExitSelectMode={() => setSelectMode(false)}
            sortState={sortState}
            onGroupSortChange={changeGroupSort}
          />
        </div>
        {/* -mx-4 cancels page padding so the phone list runs edge to edge. */}
        <div className="lg:hidden -mx-4">
          <ScheduleListMobile
            week={mobileWeek}
            windowWeeks={weeks}
            employees={employees}
            vehicles={vehicles}
            filtered={filtered}
            selectMode={selectMode && !isWide}
            onExitSelectMode={() => setSelectMode(false)}
            sortState={sortState}
            onGroupSortChange={changeGroupSort}
          />
        </div>
        {/* Rendered once, outside both layouts — both are always mounted, so
            giving each the deep link opened two stacked sheets. */}
        <DeepLinkedVisitSheet weeks={weeks} visitId={initialVisitId} />
      </div>
    </div>
  )
}

/** One entry per account, sorted by name — the account filter's option list. */
function dedupeAccounts(accounts: Account[]): Account[] {
  const byId = new Map<string, Account>()
  for (const account of accounts) {
    if (!byId.has(account.id)) byId.set(account.id, account)
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** First-load placeholder for ScheduleView. Shares its shape with
 *  app/app/(padded)/schedule/loading.tsx, which covers the RSC shell. */
function ScheduleSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-56 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, row) => (
              <Skeleton key={row} className="h-14 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

type ScheduleViewMode = 'today' | 'week'

/** `Today | Week` — the dashboard folded into the schedule. */
function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: ScheduleViewMode
  onChange: (value: ScheduleViewMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Schedule view"
      className="flex gap-1 rounded-lg bg-secondary p-1"
    >
      {(['today', 'week'] as const).map((mode) => (
        <button
          key={mode}
          role="tab"
          type="button"
          aria-selected={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'min-h-9 flex-1 rounded-md text-sm font-semibold capitalize transition-colors',
            value === mode
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

/**
 * Sticks the filters and week nav to the top, publishing its height as --schedule-sticky-h for
 * ScheduleGrid's header. On a phone it re-applies page padding itself so it spans edge to edge.
 */
function ScheduleStickyBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => {
      document.documentElement.style.setProperty('--schedule-sticky-h', `${el.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--schedule-sticky-h')
    }
  }, [])

  return (
    <div
      ref={ref}
      className="sticky top-0 z-40 -mx-4 bg-background px-4 pb-2 mb-2 lg:mx-0 lg:px-0 lg:pb-3 lg:mb-3"
    >
      {children}
    </div>
  )
}
