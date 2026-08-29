'use client'

import { toast } from 'sonner'
import { RoutePicker } from '@/components/management/RoutePicker'
import { useRoutesData } from '@/hooks/useRoutes'
import { useAssignPropertyRoute } from '@/hooks/useAssignPropertyRoute'
import { toUserMessage } from '@/lib/errors'

interface PropertyRoutePickerProps {
  propertyId: string
  propertyAddress: string
  currentRouteGroupId: string | null
}

/**
 * Put one property on a route, from wherever the property already is.
 *
 * The account page could previously only *display* a property's route and link
 * to /app/routes with no property context — so routing one property meant
 * leaving the page, finding it again in a list of every property, and losing
 * your place. This is the same write, without the round trip.
 *
 * Queued, so it works from the truck.
 */
export function PropertyRoutePicker({
  propertyId,
  propertyAddress,
  currentRouteGroupId,
}: PropertyRoutePickerProps) {
  const { data } = useRoutesData()
  const assign = useAssignPropertyRoute()

  const routeGroups = data?.routeGroups ?? []
  if (routeGroups.length === 0) return null

  function nameOf(routeGroupId: string) {
    return routeGroups.find((rg) => rg.id === routeGroupId)?.name ?? 'the route'
  }

  async function apply(routeGroupId: string | null) {
    const previous = currentRouteGroupId
    try {
      await assign.mutateAsync({
        propertyId,
        routeGroupId,
        label: propertyAddress,
      })
      toast.success(
        routeGroupId
          ? `${propertyAddress} added to ${nameOf(routeGroupId)}.`
          : `${propertyAddress} taken off its route.`,
        {
          action: {
            label: 'Undo',
            onClick: () => {
              void assign
                .mutateAsync({ propertyId, routeGroupId: previous, label: propertyAddress })
                .catch(() => toast.error('Could not undo'))
            },
          },
        },
      )
    } catch (err) {
      toast.error('Could not change the route', {
        description: toUserMessage(err, 'It is queued and will retry.', '[PropertyRoutePicker]'),
      })
    }
  }

  return (
    <RoutePicker
      routeGroups={routeGroups}
      value={currentRouteGroupId}
      label={currentRouteGroupId ? 'Change route' : 'Put on a route'}
      disabled={assign.isPending}
      onSelect={(routeGroupId) => void apply(routeGroupId)}
      onClear={currentRouteGroupId ? () => void apply(null) : undefined}
      className="h-9"
    />
  )
}
