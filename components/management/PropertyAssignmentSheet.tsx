'use client'

import { useMemo, useState, useTransition } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { assignProperty, unassignProperty } from '@/app/management/route-groups/actions'
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
 * Properties are grouped by account for scanability, but every property gets
 * its own toggle — no account-level bulk control. A property already assigned
 * to a DIFFERENT route group can still be toggled here; flipping it prompts a
 * confirmation dialog (moving it out of its current group) rather than being
 * disabled outright.
 */
export function PropertyAssignmentSheet({
  routeGroupId,
  routeGroupName,
  allProperties,
}: PropertyAssignmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reassignTarget, setReassignTarget] = useState<PropertyWithAccount | null>(null)
  const [unassignedOnly, setUnassignedOnly] = useState(false)

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

  // "Unassigned" = not part of any route group (currentRouteGroup null) — the
  // set of properties still needing a first assignment, as distinct from ones
  // already elsewhere (which stay visible unfiltered so they can be moved).
  const visibleAccountGroups = useMemo<AccountGroup[]>(() => {
    if (!unassignedOnly) return accountGroups
    return accountGroups
      .map((group) => ({
        ...group,
        properties: group.properties.filter((p) => !p.currentRouteGroup),
      }))
      .filter((group) => group.properties.length > 0)
  }, [accountGroups, unassignedOnly])

  function doToggle(propertyId: string, isAssignedHere: boolean) {
    startTransition(async () => {
      const res = isAssignedHere
        ? await unassignProperty(propertyId, routeGroupId)
        : await assignProperty(propertyId, routeGroupId)

      if (res.error) {
        toast.error('Could not update assignment', { description: res.error })
      }
    })
  }

  function handleToggle(property: PropertyWithAccount, isAssignedHere: boolean) {
    const isLocked = !!property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId
    if (isLocked) {
      setReassignTarget(property)
      return
    }
    doToggle(property.id, isAssignedHere)
  }

  function confirmReassign() {
    if (!reassignTarget) return
    doToggle(reassignTarget.id, false)
    setReassignTarget(null)
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
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Assign Properties</SheetTitle>
            <SheetDescription>
              Toggle properties in and out of <strong>{routeGroupName}</strong>.
            </SheetDescription>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="unassigned-only"
                checked={unassignedOnly}
                onCheckedChange={setUnassignedOnly}
                className="shrink-0"
              />
              <Label htmlFor="unassigned-only" className="text-sm text-muted-foreground font-normal">
                Unassigned only
              </Label>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {visibleAccountGroups.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground text-center px-6">
                {accountGroups.length === 0
                  ? 'No properties exist yet.'
                  : 'No unassigned properties.'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visibleAccountGroups.map((group) => {
                  if (group.properties.length === 1) {
                    const property = group.properties[0]
                    const isAssignedHere = property.currentRouteGroup?.id === routeGroupId

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
                          {property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId && (
                            <p className="text-[11px] text-muted-foreground/80 truncate">
                              Currently in {property.currentRouteGroup.name}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={isAssignedHere}
                          disabled={pending}
                          onCheckedChange={() => handleToggle(property, isAssignedHere)}
                          aria-label={isAssignedHere ? 'Remove from group' : 'Add to group'}
                          className="shrink-0"
                        />
                      </li>
                    )
                  }

                  return (
                    <li key={group.accountId}>
                      <div className="px-6 pt-3.5 pb-1 bg-muted/30">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {group.accountName}
                        </p>
                      </div>
                      <ul className="divide-y divide-border/60">
                        {group.properties.map((property) => {
                          const isAssignedHere = property.currentRouteGroup?.id === routeGroupId

                          return (
                            <li
                              key={property.id}
                              className="flex items-center justify-between gap-3 pl-8 pr-6 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">
                                  {property.address}
                                </p>
                                {property.currentRouteGroup && property.currentRouteGroup.id !== routeGroupId && (
                                  <p className="text-[11px] text-muted-foreground/80 truncate">
                                    Currently in {property.currentRouteGroup.name}
                                  </p>
                                )}
                              </div>
                              <Switch
                                checked={isAssignedHere}
                                disabled={pending}
                                onCheckedChange={() => handleToggle(property, isAssignedHere)}
                                aria-label={isAssignedHere ? 'Remove from group' : 'Add to group'}
                                className="shrink-0"
                              />
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

          {reassignTarget && (
            // Rendered inline within the Sheet (not a separate Radix Dialog)
            // deliberately — nesting a second Radix Dialog/Sheet root here
            // causes their dismissable-layer stacks to cross-dismiss each
            // other on outside clicks (well-documented Radix issue), closing
            // this Sheet whenever the confirmation is dismissed. A plain
            // absolutely-positioned overlay sidesteps that entirely.
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6">
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Move to {routeGroupName}?
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <strong className="text-foreground">{reassignTarget.address}</strong> is
                  already assigned to{' '}
                  <strong className="text-foreground">
                    {reassignTarget.currentRouteGroup?.name}
                  </strong>
                  . Adding it here will remove it from that route group.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setReassignTarget(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={confirmReassign} disabled={pending}>
                    Move property
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
