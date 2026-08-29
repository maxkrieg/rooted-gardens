'use client'

import { useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchScheduleReference, fetchWeekVisits } from '@/lib/schedule/fetch'
import { buildScheduleWeek } from '@/lib/utils/schedule'
import { visitVersion, type VisitOverlay } from '@/lib/utils/visits'
import type { ScheduleWeek, VisitWithCrew } from '@/types/app'

export const scheduleReferenceKey = ['schedule-reference'] as const
export const scheduleVisitsKey = (weekStartISO: string) => ['schedule-visits', weekStartISO]

/** Week-independent half of the schedule. Route groups and properties barely
 *  change during a session, so this is cached once for every week on screen. */
export function useScheduleReference() {
  return useQuery({
    queryKey: scheduleReferenceKey,
    queryFn: fetchScheduleReference,
    staleTime: 5 * 60_000,
  })
}

/**
 * The management schedule for `weekStarts`, composed client-side so it reads from
 * the persisted cache offline. Replaces four `getScheduleForWeek` Server Action
 * calls (~22-26 queries) with 3 shared + 1-2 per week.
 */
export function useManagementSchedule(weekStarts: string[]) {
  const reference = useScheduleReference()

  const referenceData = reference.data
  const weeksKey = weekStarts.join(',')

  // Composed inside `combine` so React Query memoizes it against the underlying
  // results — rebuilding every week on each render would churn the whole grid.
  const combine = useCallback(
    (results: Array<{ data?: VisitWithCrew[]; isLoading: boolean; isError: boolean }>) => {
      const weeks = weeksKey
        .split(',')
        .map((weekStartISO, i) =>
          buildScheduleWeek(
            weekStartISO,
            referenceData?.routeGroups ?? [],
            referenceData?.assignments ?? [],
            results[i]?.data ?? [],
            referenceData?.ungroupedProperties ?? [],
          ),
        )
      return {
        weeks,
        isLoading: results.some((r) => r.isLoading),
        isError: results.some((r) => r.isError),
        hasAll: results.every((r) => !!r.data),
      }
    },
    [referenceData, weeksKey],
  )

  const visits = useQueries({
    queries: weekStarts.map((weekStartISO) => ({
      queryKey: scheduleVisitsKey(weekStartISO),
      queryFn: () => fetchWeekVisits(weekStartISO, { withInvoices: true }),
      staleTime: 60_000,
    })),
    combine,
  })

  const isLoading = reference.isLoading || visits.isLoading
  const isError = reference.isError || visits.isError
  // Cached data exists but the network failed — render it flagged as stale
  // rather than showing an error over data the owner can still use.
  const hasData = !!referenceData && visits.hasAll

  return {
    weeks: visits.weeks as ScheduleWeek[],
    isLoading,
    isError,
    isStale: isError && hasData,
    hasData,
  }
}

/**
 * Patch one visit wherever it sits in the cached weeks.
 *
 * Drawer writes only touch `['stop-detail']`, and the realtime overlay carries a
 * `visits` row — so nothing propagates `visit_crew` (a different table) to the
 * grid. Works offline, unlike an invalidate.
 */
export function patchScheduleVisit(
  queryClient: QueryClient,
  visitId: string,
  update: (visit: VisitWithCrew) => VisitWithCrew,
): void {
  const entries = queryClient.getQueriesData<VisitWithCrew[]>({ queryKey: ['schedule-visits'] })
  for (const [key, data] of entries) {
    if (!data?.some((v) => v.id === visitId)) continue
    queryClient.setQueryData<VisitWithCrew[]>(
      key,
      data.map((v) => (v.id === visitId ? update(v) : v)),
    )
  }
}

/**
 * Apply a live visit update — a Realtime UPDATE, or a write the drawer just
 * made — straight into the query cache.
 *
 * This replaces the separate overlay `Map` that used to sit beside React Query.
 * That map existed because the grid once read server props and had nowhere else
 * to put live data; it now reads the cache, so a third store only meant every
 * consumer had to remember to merge.
 *
 * The `updated_at` guard is the part that has to survive: applied
 * unconditionally, a dropped or out-of-order Realtime message would pin a stale
 * status on a cell and beat fresher server data on every later render. Compared
 * numerically via `visitVersion` because PostgREST and Realtime don't format
 * timestamps identically ('…Z' vs '…+00:00'), which breaks string ordering.
 *
 * Returning the previous data object unchanged when the incoming row is not
 * newer is load-bearing: a new object identity here re-renders the whole grid.
 */
export function applyVisitUpdate(queryClient: QueryClient, incoming: VisitOverlay): void {
  const incomingVersion = visitVersion(incoming)
  // No usable version marker — applying it would make every later comparison
  // undecidable, so drop it rather than guess.
  if (incomingVersion === null) return

  for (const [key, data] of queryClient.getQueriesData<VisitWithCrew[]>({
    queryKey: ['schedule-visits'],
  })) {
    if (!data) continue
    const existing = data.find((v) => v.id === incoming.id)
    if (!existing) continue
    const existingVersion = visitVersion(existing)
    if (existingVersion === null || existingVersion >= incomingVersion) continue
    queryClient.setQueryData<VisitWithCrew[]>(
      key,
      data.map((v) => (v.id === incoming.id ? { ...v, ...incoming } : v)),
    )
  }

  // The drawer reads its own entry, shared with the crew stop page.
  queryClient.setQueryData<{ visit: { id: string; updated_at?: string } } | null>(
    ['stop-detail', incoming.id],
    (old) => {
      if (!old?.visit) return old
      const existingVersion = visitVersion(old.visit)
      if (existingVersion === null || existingVersion >= incomingVersion) return old
      return { ...old, visit: { ...old.visit, ...incoming } }
    },
  )
}

/** `applyVisitUpdate` bound to the active client, for components. */
export function useApplyVisitUpdate() {
  const queryClient = useQueryClient()
  return useCallback(
    (visit: VisitOverlay) => applyVisitUpdate(queryClient, visit),
    [queryClient],
  )
}

/**
 * Repaint the schedule after a Server Action wrote to it.
 *
 * The schedule is client-first: `revalidatePath` refreshes an RSC shell holding
 * no data, so without this a write lands in Postgres and the screen never
 * changes. The realtime overlay hides half of it — a `visits` UPDATE (a vehicle,
 * say) arrives on its own, while `visit_crew` rows do not, because the
 * management subscription only covers `visits`. That asymmetry makes the bug
 * look like a rendering glitch rather than a missing invalidation.
 */
export function useRefreshSchedule() {
  const queryClient = useQueryClient()

  return useCallback(
    (weekStartISO?: string) => {
      queryClient.invalidateQueries({
        queryKey: weekStartISO ? scheduleVisitsKey(weekStartISO) : ['schedule-visits'],
      })
      // The drawer reads its own entry, and shares it with the crew stop page.
      queryClient.invalidateQueries({ queryKey: ['stop-detail'] })
    },
    [queryClient],
  )
}

/** Warms the neighbouring weeks so paging works with no signal. */
export function usePrefetchWeeks() {
  const queryClient = useQueryClient()

  return useCallback(
    (weekStarts: string[]) => {
      for (const weekStartISO of weekStarts) {
        queryClient.prefetchQuery({
          queryKey: scheduleVisitsKey(weekStartISO),
          queryFn: () => fetchWeekVisits(weekStartISO, { withInvoices: true }),
          staleTime: 60_000,
        })
      }
    },
    [queryClient],
  )
}
