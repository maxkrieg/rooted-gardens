'use client'

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchScheduleReference, fetchWeekVisits } from '@/lib/schedule/fetch'
import { buildScheduleWeek } from '@/lib/utils/schedule'
import { visitVersion, type VisitOverlay } from '@/lib/utils/visits'
import { flushMutationQueue } from '@/lib/offline/mutation-queue'
import { propertyHistoryKey } from '@/hooks/usePropertyHistory'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
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

/** The schedule for `weekStarts`, composed client-side from the persisted cache. */
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

/** Patch one visit in every cached week. Needed for visit_crew, which realtime doesn't carry. */
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

/** A queued visit edit, patched into both the schedule and stop-detail caches up front.
 *  `networkMode: 'always'`: the default pauses offline, running onMutate but never enqueuing. */
export function useQueuedVisitMutation<TInput>(
  visitId: string,
  {
    enqueue,
    patchVisit,
    patchStop,
  }: {
    enqueue: (input: TInput) => Promise<unknown>
    patchVisit: (visit: VisitWithCrew, input: TInput) => VisitWithCrew
    patchStop: (stop: StopDetail, input: TInput) => StopDetail
  },
) {
  const queryClient = useQueryClient()
  const stopKey = ['stop-detail', visitId]

  return useMutation({
    networkMode: 'always',
    mutationFn: async (input: TInput) => {
      await enqueue(input)
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: stopKey })
      const previous = queryClient.getQueryData<StopDetail | null>(stopKey)
      patchScheduleVisit(queryClient, visitId, (visit) => patchVisit(visit, input))
      queryClient.setQueryData<StopDetail | null>(stopKey, (old) =>
        old ? patchStop(old, input) : old,
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(stopKey, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stopKey })
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
      // Reverts and crew edits change a past visit's history row; the property isn't known here.
      queryClient.invalidateQueries({ queryKey: ['property-history'] })
    },
  })
}

/**
 * Write a live visit update into the cache, guarded on updated_at so an out-of-order message
 * can't pin stale data. Compared numerically (formats differ). Returns the old object when not
 * newer: a new identity re-renders the grid.
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
    // A live completion or skip (e.g. from a crew phone) is that property's newest history.
    if (incoming.status && incoming.status !== existing.status) {
      queryClient.invalidateQueries({ queryKey: propertyHistoryKey(existing.property_id) })
    }
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

/** Repaint after a Server Action: revalidatePath can't reach this client-first page. */
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
