'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { routesDataKey } from '@/hooks/useRoutes'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'
import { emitTourEvent } from '@/lib/onboarding/events'
import type { ScheduleReference } from '@/lib/schedule/fetch'
import type { RoutesData } from '@/lib/routes/fetch'
import type { ScheduleAssignment } from '@/lib/utils/schedule'

/** Just the slice of AccountDetail this touches, to avoid importing the shape. */
type AccountDetailLike = {
  routeGroupByPropertyId?: Record<string, { id: string; name: string }>
}

type AssignPropertyRouteInput = {
  propertyId: string
  /** null removes the property from every route group. */
  routeGroupId: string | null
  /** Position within the route; drive order. Appended to the end by default. */
  sortOrder?: number
  /** Shown in "Changes that didn't save" when this one gets stuck. */
  label?: string
  /** For batches that own their optimistic state (a reorder): skip the patch and invalidation. */
  silent?: boolean
}

/**
 * Move a property onto a route, or off all routes, via the offline queue. Caches are patched
 * by hand, not invalidated: offline, an invalidation is a failed refetch.
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
      // Read before patching: the badge delta depends on where the property was.
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
          // Insert at its position; this list is drive order.
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

        // Carry the row's nested property+account over from its old assignment or the ungrouped
        // bucket.
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

      // The account page keeps its own routeGroupByPropertyId map; patch it too.
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

    onSuccess: (_data, variables) => {
      if (variables.routeGroupId && !variables.silent) emitTourEvent('routes.propertyRouted')
    },

    onSettled: (_data, _error, variables) => {
      if (variables?.silent) return
      // Reconciles against the server when online; offline these no-op.
      queryClient.invalidateQueries({ queryKey: routesDataKey })
      queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
      queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
      queryClient.invalidateQueries({ queryKey: ['account-detail'] })
    },
  })
}
