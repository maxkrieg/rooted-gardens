'use client'

import { useState } from 'react'
import { MapPin, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { PropertyForm } from '@/components/management/PropertyForm'
import type { Property } from '@/types/app'

interface PropertySheetProps {
  accountId: string
  /** Omit to render an "Add Property" trigger; provide to render an "Edit" trigger. */
  property?: Property
}

/**
 * Client island that owns the add/edit property Sheet's open state.
 * When property is undefined → "Add Property" trigger + create form.
 * When property is provided → "Edit" icon trigger + edit form.
 */
export function PropertySheet({ accountId, property }: PropertySheetProps) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(property)

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setOpen(true)}
          aria-label="Edit property"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => setOpen(true)}
        >
          <MapPin className="h-3.5 w-3.5" />
          <Plus className="h-3 w-3 -ml-1" />
          Add Property
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">
              {isEdit ? 'Edit Property' : 'Add Property'}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update the address and standing notes for this property.'
                : 'Add a property to this account. A default zone will be created automatically for per-visit accounts.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <PropertyForm
              accountId={accountId}
              property={property}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
