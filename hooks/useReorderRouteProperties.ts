'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAssignPropertyRoute } from '@/hooks/useAssignPropertyRoute'
import { routesDataKey } from '@/hooks/useRoutes'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import type { RoutesData } from '@/lib/routes/fetch'
import type { ScheduleReference } from '@/lib/schedule/fetch'

/**
 * Move one property up or down within its route — the route's drive order.
 *
 * `property_route_groups.sort_order` has existed all along, is already fetched,
 * and `buildScheduleWeek` already sorts by it. It was simply always written as
 * `0`, so every route rendered in whatever order Postgres returned. This writes
 * a real value, which is what makes the crew's stop list match the order they
 * actually drive — the thing the spreadsheet's row order has always meant.
 *
 * The batch owns its own optimistic state and each write runs `silent`. Letting
 * the per-row mutation patch and invalidate made a single move visibly bounce:
 * the row jumped, a mid-flight refetch returned the pre-move order, then the
 * next write moved it again.
 *
 * Only rows whose position actually changes are written. On a route that has
 * never been ordered every `sort_order` is 0, so the first move renumbers the
 * whole group once and every move after it touches two rows.
 */
export function useReorderRouteProperties() {
  const assign = useAssignPropertyRoute()
  const queryClient = useQueryClient()

  return useCallback(
    async (
      routeGroupId: string,
      orderedPropertyIds: string[],
      currentSortOrders: Record<string, number>,
      labelByPropertyId: Record<string, string> = {},
    ) => {
      // One patch for the whole new order, before anything is written.
      queryClient.setQueryData<RoutesData>(routesDataKey, (old) =>
        old
          ? {
              ...old,
              assignedIdsByGroup: {
                ...old.assignedIdsByGroup,
                [routeGroupId]: orderedPropertyIds,
              },
              sortOrderByPropertyId: {
                ...old.sortOrderByPropertyId,
                ...Object.fromEntries(orderedPropertyIds.map((id, i) => [id, i])),
              },
            }
          : old,
      )

      // The schedule sorts its rows by the same column, so it has to move too —
      // and offline this patch is the only thing that will ever move it.
      const positions = new Map(orderedPropertyIds.map((id, i) => [id, i]))
      queryClient.setQueryData<ScheduleReference>(scheduleReferenceKey, (old) =>
        old
          ? {
              ...old,
              assignments: old.assignments.map((a) =>
                positions.has(a.property_id)
                  ? { ...a, sort_order: positions.get(a.property_id)! }
                  : a,
              ),
            }
          : old,
      )

      try {
        for (const [index, propertyId] of orderedPropertyIds.entries()) {
          if (currentSortOrders[propertyId] === index) continue
          await assign.mutateAsync({
            propertyId,
            routeGroupId,
            sortOrder: index,
            label: labelByPropertyId[propertyId],
            silent: true,
          })
        }
      } finally {
        // Once, after the batch. Online this reconciles; offline it's a no-op
        // and the patches above stand on their own.
        queryClient.invalidateQueries({ queryKey: routesDataKey })
        queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
        queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
      }
    },
    [assign, queryClient],
  )
}

/**
 * Move the item at `from` into the gap at `gap`, where gap `g` means "before the
 * item currently at index `g`" — so gaps run 0…length inclusive.
 *
 * The index shifts once the item is lifted out, which is the whole subtlety: a
 * gap *after* the original position is one lower by the time we insert.
 *
 * Returns the same array reference for a no-op (the gaps either side of the
 * item), so callers can skip the write with an identity check.
 */
export function moveToGap<T>(items: T[], from: number, gap: number): T[] {
  if (gap === from || gap === from + 1) return items
  if (from < 0 || from >= items.length || gap < 0 || gap > items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(gap > from ? gap - 1 : gap, 0, item)
  return next
}
