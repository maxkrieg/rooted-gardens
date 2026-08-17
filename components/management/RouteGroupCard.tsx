'use client'

import { useState, useTransition } from 'react'
import { Building2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/states/EmptyState'
import { FrequencyBadge } from '@/components/management/badges'
import { RouteGroupSheet } from '@/components/management/RouteGroupSheet'
import { PropertyAssignmentSheet } from '@/components/management/PropertyAssignmentSheet'
import { deleteRouteGroup, moveRouteGroup } from '@/app/management/routes/actions'
import type { RouteGroup, PropertyWithAccount } from '@/types/app'

interface RouteGroupCardProps {
  routeGroup: RouteGroup
  assignedProperties: PropertyWithAccount[]
  allProperties: PropertyWithAccount[]
  isFirst: boolean
  isLast: boolean
}

export function RouteGroupCard({
  routeGroup,
  assignedProperties,
  allProperties,
  isFirst,
  isLast,
}: RouteGroupCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleMove(direction: 'up' | 'down') {
    startTransition(async () => {
      const res = await moveRouteGroup(routeGroup.id, direction)
      if (res.error) toast.error('Could not reorder route group', { description: res.error })
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteRouteGroup(routeGroup.id)
      if (res.error) {
        toast.error('Could not delete route group', { description: res.error })
        setConfirmDelete(false)
      }
      // On success, revalidatePath removes this card from the list
    })
  }

  return (
    <Card className="rounded-2xl border border-border shadow-warm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          {/* Name + count */}
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-foreground leading-tight truncate">
              {routeGroup.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {assignedProperties.length}{' '}
              {assignedProperties.length === 1 ? 'property' : 'properties'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Reorder */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isFirst || pending}
              onClick={() => handleMove('up')}
              aria-label="Move route group up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={isLast || pending}
              onClick={() => handleMove('down')}
              aria-label="Move route group down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>

            {/* Separator */}
            <span className="w-px h-4 bg-border mx-0.5" aria-hidden />

            <RouteGroupSheet routeGroup={routeGroup} />

            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs px-2"
                  disabled={pending}
                  onClick={handleDelete}
                >
                  {pending ? 'Deleting…' : 'Confirm delete'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-2"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete route group"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Assigned properties list */}
        {assignedProperties.length === 0 ? (
          // The card already has its own "Assign" control, so stay compact.
          <EmptyState
            compact
            title="No properties assigned"
            hint="Assign properties to put this group on the schedule."
            className="mb-3"
          />
        ) : (
          <ul className="space-y-2.5 mb-3">
            {assignedProperties.map((property) => (
              <li key={property.id} className="flex items-start gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                {/* Account first, address below — mirrors the schedule grid's
                    label column so owners can toggle between the two pages. */}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-semibold leading-snug text-foreground truncate">
                    {property.accountName}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] leading-snug text-muted-foreground truncate">
                      {property.address}
                    </span>
                    <span className="shrink-0">
                      <FrequencyBadge frequency={property.frequency} />
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Manage properties trigger */}
        <PropertyAssignmentSheet
          routeGroupId={routeGroup.id}
          routeGroupName={routeGroup.name}
          allProperties={allProperties}
        />
      </CardContent>
    </Card>
  )
}
