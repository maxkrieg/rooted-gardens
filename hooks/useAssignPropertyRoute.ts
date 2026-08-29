'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { routesDataKey } from '@/hooks/useRoutes'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import type { ScheduleReference } from '@/lib/schedule/fetch'
import type { RoutesData } from '@/lib/routes/fetch'
import type { ScheduleAssignment } from '@/lib/utils/schedule'

/** Just the slice of AccountDetail this touches, to avoid importing the shape. */
type AccountDetailLike = {
  routeGroupByPropertyId?: Record<string, { id: string; name: string }>
}

export type AssignPropertyRouteInput = {
  propertyId: string
  /** null removes the property from every route group. */
  routeGroupId: string | null
  /** Position within the route; drive order. Appended to the end by default. */
  sortOrder?: number
  /** Shown in "Changes that didn't save" when this one gets stuck. */
  label?: string
  /**
   * Skip the cache patch and the invalidation. For callers issuing a *batch*
   * that owns its own optimistic state — a reorder, where patching per row
   * would animate the list through every intermediate order, and invalidating
   * per row would refetch the pre-batch order mid-flight.
   */
  silent?: boolean
}

/**
 * Move one property onto a route group, or off routes entirely — through the
 * offline queue.
 *
 * This was the one field route whose writes were still Server Actions, which is
 * indefensible for a page used from a truck: routing a property is exactly the
 * kind of small correction made while standing in front of it.
 *
 * Every cache it touches is patched by hand rather than invalidated. An
 * invalidation offline is a refetch that fails, and the point of queuing the
 * write is that the screen agrees with it immediately.
 */
export function useAssignPropertyRoute() {
  const queryClient = useQueryClient()

  return useMutation({
    // Without this React Query pauses the mutation offline: onMutate runs, so
    // the UI looks saved, but mutationFn never does and nothing is enqueued.
    networkMode: 'always',
    mutationFn: async ({
      propertyId,
      routeGroupId,
      sortOrder = 0,
      label,
    }: AssignPropertyRouteInput) => {
      await enqueueMutation('assign_property_route', { propertyId, routeGroupId, sortOrder }, label)
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },

    onMutate: ({ propertyId, routeGroupId, sortOrder = 0, silent }) => {
      if (silent) return
      // Read before patching: moving between two routes changes no count, so
      // the badge delta depends on where the property was, not just where it's
      // going.
      const wasRouted = Object.values(
        queryClient.getQueryData<RoutesData>(routesDataKey)?.assignedIdsByGroup ?? {},
      ).some((ids) => ids.includes(propertyId))

      queryClient.setQueryData<RoutesData>(routesDataKey, (old) => {
        if (!old) return old
        const assignedIdsByGroup: Record<string, string[]> = {}
        for (const [groupId, ids] of Object.entries(old.assignedIdsByGroup)) {
          assignedIdsByGroup[groupId] = ids.filter((id) => id !== propertyId)
        }
        if (routeGroupId) {
          const list = [...(assignedIdsByGroup[routeGroupId] ?? [])]
          // Insert at its position, not at the end: this list is drive order,
          // and appending made every move look like "sent to the bottom" for a
          // frame before the refetch corrected it.
          list.splice(Math.min(sortOrder, list.length), 0, propertyId)
          assignedIdsByGroup[routeGroupId] = list
        }
        return {
          ...old,
          assignedIdsByGroup,
          sortOrderByPropertyId: {
            ...old.sortOrderByPropertyId,
            ...(routeGroupId ? { [propertyId]: sortOrder } : {}),
          },
        }
      })

      queryClient.setQueryData<ScheduleReference>(scheduleReferenceKey, (old) => {
        if (!old) return old

        // The row carries the nested property+account the grid renders, so
        // moving a property means carrying that payload across rather than
        // rebuilding it — it comes either from its old assignment or from the
        // ungrouped bucket, depending on which direction this is going.
        const existing = old.assignments.find((a) => a.property_id === propertyId)
        const ungroupedMatch = old.ungroupedProperties.find((p) => p.id === propertyId)
        const nested = existing?.property ?? ungroupedMatch ?? null

        const assignments = old.assignments.filter((a) => a.property_id !== propertyId)
        let ungroupedProperties = old.ungroupedProperties.filter((p) => p.id !== propertyId)

        if (routeGroupId && nested) {
          assignments.push({
            property_id: propertyId,
            route_group_id: routeGroupId,
            sort_order: sortOrder,
            property: nested,
          } as ScheduleAssignment)
        } else if (!routeGroupId && nested) {
          ungroupedProperties = [...ungroupedProperties, nested]
        }

        return { ...old, assignments, ungroupedProperties }
      })

      // The account detail page keeps its own routeGroupByPropertyId map, so
      // without this the property card's "Route group: …" line never changed —
      // the write landed and the screen didn't move.
      const groupName = queryClient
        .getQueryData<RoutesData>(routesDataKey)
        ?.routeGroups.find((rg) => rg.id === routeGroupId)?.name

      for (const [key, detail] of queryClient.getQueriesData<AccountDetailLike>({
        queryKey: ['account-detail'],
      })) {
        if (!detail?.routeGroupByPropertyId) continue
        const next = { ...detail.routeGroupByPropertyId }
        if (routeGroupId && groupName) next[propertyId] = { id: routeGroupId, name: groupName }
        else delete next[propertyId]
        queryClient.setQueryData(key, { ...detail, routeGroupByPropertyId: next })
      }

      const isRouted = routeGroupId !== null
      if (wasRouted !== isRouted) {
        queryClient.setQueryData<number>(navUnroutedCountKey, (old) =>
          typeof old === 'number' ? Math.max(0, isRouted ? old - 1 : old + 1) : old,
        )
      }
    },

    onSettled: (_data, _error, variables) => {
      if (variables?.silent) return
      // Online this reconciles the hand-patched caches against the server.
      // Offline these are no-ops against a failed refetch, which is why the
      // patches above have to stand on their own.
      queryClient.invalidateQueries({ queryKey: routesDataKey })
      queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
      queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
      queryClient.invalidateQueries({ queryKey: ['account-detail'] })
    },
  })
}
