'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { ScheduleGrid } from '@/components/management/ScheduleGrid'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { ScheduleNav } from '@/components/management/ScheduleNav'
import { ScheduleFilterBar } from '@/components/management/ScheduleFilterBar'
import { ScheduleFilterSheet } from '@/components/management/ScheduleFilterSheet'
import { ScheduleHeaderMobile } from '@/components/management/ScheduleHeaderMobile'
import {
  ScheduleViewToggle,
  type ScheduleViewMode,
} from '@/components/management/ScheduleViewToggle'
import { DashboardView } from '@/components/management/DashboardView'
import { GenerateWeekSheet } from '@/components/management/GenerateWeekSheet'
import { useWeekPlan, useGenerateWeek } from '@/hooks/useGenerateWeek'
import { ScheduleStickyBar } from '@/components/management/ScheduleStickyBar'
import { SessionsProvider } from '@/components/management/SessionsProvider'
import { DeepLinkedVisitSheet } from '@/components/management/DeepLinkedVisitSheet'
import { ScheduleSkeleton } from '@/components/management/ScheduleSkeleton'
import { CachedNotice } from '@/components/states/CachedNotice'
import { ErrorState } from '@/components/states/ErrorState'
import type { Account } from '@/types/app'

interface ScheduleViewProps {
  initialWeek: string
  initialFilters: ScheduleFilterValues
  initialVisitId: string | undefined
  /** `?view=` when the URL names one — the old /app/dashboard redirect does.
   *  null means "no instruction", and the stored preference decides. */
  initialViewMode: ScheduleViewMode | null
}

const VIEW_MODE_KEY = 'rg-schedule-view'

/**
 * Client-first schedule. Week and filter state live here rather than in the URL's
 * server round-trip, so paging and filtering work with no signal; the URL is kept
 * in sync with replaceState purely so a view stays shareable.
 */
export function ScheduleView({
  initialWeek,
  initialFilters,
  initialVisitId,
  initialViewMode,
}: ScheduleViewProps) {
  const [windowStart, setWindowStart] = useState(initialWeek)
  const [filters, setFilters] = useState<ScheduleFilterValues>(initialFilters)
  // Matches the `lg:` breakpoint the two layouts switch on, so a phone never
  // fetches the three extra weeks only the desktop grid renders.
  const isWide = useMediaQuery('(min-width: 1024px)')
  const weekCount = isWide ? 4 : 1
  const hydrated = useIsHydrated()
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [viewOverride, setViewOverride] = useState<ScheduleViewMode | null>(null)
  const { editSchedule: canEdit, seeDashboard } = useCan()

  // Last-used view wins on open, so whichever one he actually lives in is the
  // default. Resolved rather than stored in state: localStorage doesn't exist
  // during the server render, and syncing it into state in an effect would
  // render the wrong tab once before correcting it. Precedence is
  // explicit tap → explicit ?view= → last used → Week.
  const storedViewMode = useMemo<ScheduleViewMode | null>(() => {
    if (!hydrated) return null
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY)
      return stored === 'today' || stored === 'week' ? stored : null
    } catch {
      return null
    }
  }, [hydrated])

  // Crew never had a dashboard and shouldn't get one here — it carries
  // company-wide stats and uninvoiced counts. No toggle, no Today, no
  // 44px of chrome they'd never use.
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
          <ScheduleNav windowStart={windowStart} onWeekChange={goToWeek} />
        </div>
      </ScheduleStickyBar>

      {/* Under the sticky bar, not inside it — it scrolls away, because once
          you're reading the week you don't need the switch pinned. */}
      {seeDashboard && (
        <div className="mb-2 max-w-xs lg:mb-3">
          <ScheduleViewToggle value={viewMode} onChange={changeViewMode} />
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
      <SessionsProvider visitIds={visitIds}>
        <div className="hidden lg:block">
          <ScheduleGrid
            weeks={gridWeeks}
            employees={employees}
            vehicles={vehicles}
            filtered={filtered}
          />
        </div>
        <div className="lg:hidden">
          <ScheduleListMobile
            week={mobileWeek}
            windowWeeks={weeks}
            employees={employees}
            vehicles={vehicles}
            filtered={filtered}
            selectMode={selectMode}
            onExitSelectMode={() => setSelectMode(false)}
          />
        </div>
        {/* Rendered once, outside both layouts — both are always mounted, so
            giving each the deep link opened two stacked sheets. */}
        <DeepLinkedVisitSheet weeks={weeks} visitId={initialVisitId} />
      </SessionsProvider>
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
