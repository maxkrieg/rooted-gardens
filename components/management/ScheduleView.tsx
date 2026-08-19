'use client'

import { useEffect, useMemo, useState } from 'react'
import { addWeeks, format } from 'date-fns'
import { WifiOff } from 'lucide-react'
import { getWeekStart, parseWeekParam } from '@/lib/utils/schedule'
import {
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
import { ScheduleGrid } from '@/components/management/ScheduleGrid'
import { ScheduleListMobile } from '@/components/management/ScheduleListMobile'
import { ScheduleNav } from '@/components/management/ScheduleNav'
import { ScheduleFilterBar } from '@/components/management/ScheduleFilterBar'
import { ScheduleStickyBar } from '@/components/management/ScheduleStickyBar'
import { SessionsProvider } from '@/components/management/SessionsProvider'
import { DeepLinkedVisitSheet } from '@/components/management/DeepLinkedVisitSheet'
import { ScheduleSkeleton } from '@/components/management/ScheduleSkeleton'
import { ErrorState } from '@/components/states/ErrorState'
import type { Account, EmployeeRole } from '@/types/app'

interface ScheduleViewProps {
  initialWeek: string
  initialFilters: ScheduleFilterValues
  initialVisitId: string | undefined
  role: EmployeeRole
}

/**
 * Client-first schedule. Week and filter state live here rather than in the URL's
 * server round-trip, so paging and filtering work with no signal; the URL is kept
 * in sync with replaceState purely so a view stays shareable.
 */
export function ScheduleView({
  initialWeek,
  initialFilters,
  initialVisitId,
  role,
}: ScheduleViewProps) {
  const [windowStart, setWindowStart] = useState(initialWeek)
  const [filters, setFilters] = useState<ScheduleFilterValues>(initialFilters)
  // Matches the `lg:` breakpoint the two layouts switch on, so a phone never
  // fetches the three extra weeks only the desktop grid renders.
  const isWide = useMediaQuery('(min-width: 1024px)')
  const weekCount = isWide ? 4 : 1
  const hydrated = useIsHydrated()

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
    window.history.replaceState(null, '', `/management/schedule?${params.toString()}`)
  }, [filters, windowStart])

  const canEdit = role === 'owner' || role === 'lead'
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

  return (
    <div>
      <h1 className="mb-3 min-w-0 truncate font-display text-2xl font-semibold text-foreground">
        Schedule
      </h1>
      <ScheduleStickyBar>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
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

      {isStale && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Showing your last saved copy — changes sync when you&rsquo;re back online.
        </p>
      )}

      <SessionsProvider visitIds={visitIds}>
        <div className="hidden lg:block">
          <ScheduleGrid
            weeks={gridWeeks}
            employees={employees}
            vehicles={vehicles}
            canEdit={canEdit}
            role={role}
            filtered={filtered}
          />
        </div>
        <div className="lg:hidden">
          <ScheduleListMobile
            week={mobileWeek}
            windowWeeks={weeks}
            employees={employees}
            vehicles={vehicles}
            canEdit={canEdit}
            role={role}
            filtered={filtered}
          />
        </div>
        {/* Rendered once, outside both layouts — both are always mounted, so
            giving each the deep link opened two stacked sheets. */}
        <DeepLinkedVisitSheet weeks={weeks} visitId={initialVisitId} role={role} />
      </SessionsProvider>
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
