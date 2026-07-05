'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { RouteGroupForm } from '@/components/management/RouteGroupForm'
import { PropertyAssignmentFields } from '@/components/management/PropertyAssignmentFields'
import type { RouteGroup, PropertyWithAccount } from '@/types/app'

interface RouteGroupSheetProps {
  routeGroup?: RouteGroup
  allProperties?: PropertyWithAccount[]
}

/**
 * Create/edit sheet for a route group. Editing (pencil trigger) combines both
 * the name form and property assignment in one drawer — creating a new group
 * only shows the name form, since there's no route group id yet to assign
 * properties against.
 */
export function RouteGroupSheet({ routeGroup, allProperties = [] }: RouteGroupSheetProps) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(routeGroup)

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Edit route group"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          className="gap-2 h-10"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Route Group
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">
              {isEdit ? 'Edit Route Group' : 'New Route Group'}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update the name and assigned properties for this route group.'
                : 'Create a new geographic cluster for organizing daily routes.'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-5 shrink-0">
            <RouteGroupForm
              routeGroup={routeGroup}
              onSuccess={() => {
                // Creating closes the sheet (nothing else to do yet — no id to
                // assign properties against). Editing stays open so the
                // property list below remains usable in the same session.
                if (!isEdit) setOpen(false)
              }}
            />
          </div>

          {isEdit && routeGroup && (
            <PropertyAssignmentFields
              routeGroupId={routeGroup.id}
              routeGroupName={routeGroup.name}
              allProperties={allProperties}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
