'use client'

import { useState, useTransition } from 'react'
import { Map } from 'lucide-react'
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
import { assignProperty, unassignProperty } from '@/app/management/route-groups/actions'
import type { Property } from '@/types/app'

// A property enriched with its account name for display
interface PropertyWithAccount extends Property {
  accountName: string
}

interface PropertyAssignmentSheetProps {
  routeGroupId: string
  routeGroupName: string
  allProperties: PropertyWithAccount[]
  assignedIds: Set<string>
}

/**
 * Sheet that lets owners assign/unassign properties to a route group.
 * Each property row has a toggle button (check when assigned, X when not)
 * that calls the assign/unassign Server Action.
 */
export function PropertyAssignmentSheet({
  routeGroupId,
  routeGroupName,
  allProperties,
  assignedIds,
}: PropertyAssignmentSheetProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleToggle(propertyId: string, isAssigned: boolean) {
    startTransition(async () => {
      const res = isAssigned
        ? await unassignProperty(propertyId, routeGroupId)
        : await assignProperty(propertyId, routeGroupId)

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
        <Map className="h-3.5 w-3.5" />
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
            {allProperties.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No properties exist yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {allProperties.map((property) => {
                  const isAssigned = assignedIds.has(property.id)
                  return (
                    <li
                      key={property.id}
                      className="flex items-center justify-between gap-3 px-6 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {property.address}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {property.accountName}
                        </p>
                      </div>
                      <Switch
                        checked={isAssigned}
                        disabled={pending}
                        onCheckedChange={() => handleToggle(property.id, isAssigned)}
                        aria-label={isAssigned ? 'Remove from group' : 'Add to group'}
                        className="shrink-0"
                      />
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
