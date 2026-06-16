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
import { ServiceZoneForm } from '@/components/management/ServiceZoneForm'
import type { ServiceZone } from '@/types/app'

interface ServiceZoneSheetProps {
  propertyId: string
  accountId: string
  /** Provide to render an "Edit" trigger. Omit for "Add zone" trigger. */
  zone?: ServiceZone
}

export function ServiceZoneSheet({ propertyId, accountId, zone }: ServiceZoneSheetProps) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(zone)

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Edit zone"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add zone
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">
              {isEdit ? 'Edit Zone' : 'Add Zone'}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? 'Update this zone\'s name, frequency, and notes.'
                : 'Add a new service zone to this property.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <ServiceZoneForm
              propertyId={propertyId}
              accountId={accountId}
              zone={zone}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
