'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { AccountForm } from '@/components/management/AccountForm'
import type { Account } from '@/types/app'

interface EditAccountSheetProps {
  account: Account
}

/**
 * Client island that owns the Edit sheet's open state.
 * The account detail page is a Server Component and can't own useState itself,
 * so this small wrapper handles the trigger + sheet lifecycle.
 */
export function EditAccountSheet({ account }: EditAccountSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-9"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Edit Account</SheetTitle>
            <SheetDescription>
              Update the account details below.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AccountForm account={account} onSuccess={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
