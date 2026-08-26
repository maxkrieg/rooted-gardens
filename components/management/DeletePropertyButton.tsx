'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/management/ConfirmDialog'
import { archiveProperty } from '@/app/app/(padded)/accounts/property-actions'
import { useRefreshAccounts } from '@/hooks/useAccounts'

interface DeletePropertyButtonProps {
  propertyId: string
  accountId: string
  address: string
}

/**
 * Delete a single property. Soft-delete under the hood (see archiveProperty) —
 * its visits and photos are kept. On success revalidatePath drops the card,
 * which is what closes the dialog.
 *
 * Owner-only; the caller gates rendering on role, and the
 * enforce_owner_only_archive trigger is the actual enforcement.
 */
export function DeletePropertyButton({
  propertyId,
  accountId,
  address,
}: DeletePropertyButtonProps) {
  const [pending, startTransition] = useTransition()
  const refreshAccounts = useRefreshAccounts()

  function handleDelete() {
    startTransition(async () => {
      const res = await archiveProperty(propertyId, accountId)
      if (res.error) {
        toast.error('Could not delete property', { description: res.error })
        return
      }
      toast.success('Property deleted')
      refreshAccounts(accountId)
    })
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Delete property"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="Delete this property?"
      description={
        <>
          <span className="font-medium text-foreground">{address}</span> will be removed from the
          schedule and its route group. Past visits and photos are kept for your records, and any
          work that hasn&apos;t been invoiced yet stays in the billing queue.
        </>
      }
      confirmLabel="Delete property"
      pending={pending}
      onConfirm={handleDelete}
    />
  )
}
