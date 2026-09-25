'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'
import { useAssignPropertyRoute } from '@/hooks/useAssignPropertyRoute'
import { useScheduleReference } from '@/hooks/useManagementSchedule'
import type { SchedulePropertyRow } from '@/types/app'

/**
 * Put every unrouted property on one route, with Undo.
 *
 * A loop over the queued per-property mutation, not the `assignProperties`
 * Server Action: that one is a delete-then-insert that clobbers concurrent
 * edits and is deliberately online-only, and this is used from a truck.
 */
export function useRouteAllUngrouped() {
  const assignRoute = useAssignPropertyRoute()
  const { data: reference } = useScheduleReference()

  return useCallback(
    async (rows: SchedulePropertyRow[], routeGroupId: string) => {
      const name = reference?.routeGroups.find((rg) => rg.id === routeGroupId)?.name ?? 'the route'
      try {
        for (const [index, row] of rows.entries()) {
          await assignRoute.mutateAsync({
            propertyId: row.property.id,
            routeGroupId,
            sortOrder: index,
            label: row.property.address,
          })
        }
        toast.success(`${rows.length} added to ${name}.`, {
          action: {
            label: 'Undo',
            onClick: () => {
              void Promise.all(
                rows.map((row) =>
                  assignRoute.mutateAsync({
                    propertyId: row.property.id,
                    routeGroupId: null,
                    label: row.property.address,
                  }),
                ),
              ).catch(() => toast.error('Could not undo'))
            },
          },
        })
      } catch (err) {
        toast.error('Some properties were not routed', {
          description: toUserMessage(err, 'They are queued and will retry.', '[routeAllUngrouped]'),
        })
      }
    },
    [assignRoute, reference],
  )
}
