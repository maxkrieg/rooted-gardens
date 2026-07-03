'use client'

import { useMemo, useState, useTransition } from 'react'
import { Map as MapIcon, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  assignProperty,
  assignProperties,
  unassignProperty,
  unassignProperties,
} from '@/app/management/route-groups/actions'
import type { PropertyWithAccount } from '@/types/app'

interface PropertyAssignmentSheetProps {
  routeGroupId: string
  routeGroupName: string
  allProperties: PropertyWithAccount[]
}

interface AccountGroup {
  accountId: string
  accountName: string
  properties: PropertyWithAccount[]
}

/**
 * Sheet that lets owners assign/unassign properties to a route group.
 * Properties are grouped by account — a multi-property account gets a bulk
 * toggle plus individual per-property toggles; a single-property account
 * collapses to one row with one toggle (no redundant second control).
 * A property already assigned to a DIFFERENT route group is locked here —
 * property_route_groups_property_idx enforces one route group per property,
 * so it must be removed from its current group before it can be added here.
 */
export function PropertyAssignmentSheet({
  routeGroupId,
  routeGroupName,
  allProperties,
}: PropertyAssignmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const accountGroups = useMemo<AccountGroup[]>(() => {
    const map = new Map<string, AccountGroup>()
    for (const property of allProperties) {
      const existing = map.get(property.account_id)
      if (existing) {
        existing.properties.push(property)
      } else {
        map.set(property.account_id, {
          accountId: property.account_id,
          accountName: property.accountName,
          properties: [property],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.accountName.localeCompare(b.accountName))
  }, [allProperties])

  function handleToggle(propertyId: string, isAssignedHere: boolean) {
    startTransition(async () => {
      const res = isAssignedHere
        ? await unassignProperty(propertyId, routeGroupId)
        : await assignProperty(propertyId, routeGroupId)

      if (res.error) {
        toast.error('Could not update assignment', { description: res.error })
      }
    })
  }

  function handleAccountToggle(properties: PropertyWithAccount[]) {
    const eligible = properties.filter(
      (p) => !p.currentRouteGroup || p.currentRouteGroup.id === routeGroupId
    )
    const ids = eligible.map((p) => p.id)
    const allAssignedHere =
      eligible.length > 0 && eligible.every((p) => p.currentRouteGroup?.id === routeGroupId)

    startTransition(async () => {
      const res = allAssignedHere
        ? await unassignProperties(ids, routeGroupId)
        : await assignProperties(ids, routeGroupId)

      if (res.error) {
        toast.error('Could not update assignment', { description: res.error })
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <MapIcon className="h-3.5 w-3.5" />
        Manage properties
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Assign Properties</SheetTitle>
            <SheetDescription>
              Toggle properties in and out of <strong>{routeGroupName}</strong>.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {accountGroups.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No properties exist yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {accountGroups.map((group) => {
                  if (group.properties.length === 1) {
                    const property = group.properties[0]
                    const isAssignedHere = property.currentRouteGroup?.id === routeGroupId
                    const isLocked =
                      !!property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId

                    return (
                      <li
                        key={group.accountId}
                        className="flex items-center justify-between gap-3 px-6 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {group.accountName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {property.address}
                          </p>
                        </div>
                        {isLocked ? (
                          <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" />
                            In {property.currentRouteGroup!.name}
                          </div>
                        ) : (
                          <Switch
                            checked={isAssignedHere}
                            disabled={pending}
                            onCheckedChange={() => handleToggle(property.id, isAssignedHere)}
                            aria-label={isAssignedHere ? 'Remove from group' : 'Add to group'}
                            className="shrink-0"
                          />
                        )}
                      </li>
                    )
                  }

                  const eligible = group.properties.filter(
                    (p) => !p.currentRouteGroup || p.currentRouteGroup.id === routeGroupId
                  )
                  const assignedHereCount = eligible.filter(
                    (p) => p.currentRouteGroup?.id === routeGroupId
                  ).length
                  const allAssignedHere = eligible.length > 0 && assignedHereCount === eligible.length

                  return (
                    <li key={group.accountId}>
                      <div className="flex items-center justify-between gap-3 px-6 py-3.5 bg-muted/30">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {group.accountName}
                          </p>
                          {eligible.length > 0 && !allAssignedHere && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {assignedHereCount} of {eligible.length} assigned
                            </p>
                          )}
                        </div>
                        {eligible.length > 0 && (
                          <Switch
                            checked={allAssignedHere}
                            disabled={pending}
                            onCheckedChange={() => handleAccountToggle(group.properties)}
                            aria-label={
                              allAssignedHere
                                ? `Remove all ${group.accountName} properties from group`
                                : `Add all ${group.accountName} properties to group`
                            }
                            className="shrink-0"
                          />
                        )}
                      </div>
                      <ul className="divide-y divide-border/60">
                        {group.properties.map((property) => {
                          const isAssignedHere = property.currentRouteGroup?.id === routeGroupId
                          const isLocked =
                            !!property.currentRouteGroup &&
                            property.currentRouteGroup.id !== routeGroupId

                          return (
                            <li
                              key={property.id}
                              className="flex items-center justify-between gap-3 pl-8 pr-6 py-3"
                            >
                              <p className="text-sm text-foreground truncate min-w-0">
                                {property.address}
                              </p>
                              {isLocked ? (
                                <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                                  <Lock className="h-3.5 w-3.5" />
                                  In {property.currentRouteGroup!.name}
                                </div>
                              ) : (
                                <Switch
                                  checked={isAssignedHere}
                                  disabled={pending}
                                  onCheckedChange={() => handleToggle(property.id, isAssignedHere)}
                                  aria-label={isAssignedHere ? 'Remove from group' : 'Add to group'}
                                  className="shrink-0"
                                />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
