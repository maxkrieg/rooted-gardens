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

/** Swap the item at `index` with its neighbour, returning a new array. */
export function moveInArray<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
