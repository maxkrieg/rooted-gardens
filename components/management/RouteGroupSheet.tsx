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
import type { RouteGroup } from '@/types/app'

interface RouteGroupSheetProps {
  routeGroup?: RouteGroup
}

export function RouteGroupSheet({ routeGroup }: RouteGroupSheetProps) {
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
                ? 'Update the name and sort order for this route group.'
                : 'Create a new geographic cluster for organizing daily routes.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <RouteGroupForm routeGroup={routeGroup} onSuccess={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
