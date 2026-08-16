'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/management/ConfirmDialog'
import { archiveAccount } from '@/app/management/accounts/actions'

interface DeleteAccountButtonProps {
  accountId: string
  accountName: string
  /** Live (non-archived) property count, for the "…and its N properties" warning. */
  propertyCount: number
}

/**
 * Delete an account and its properties. Soft-delete under the hood (see
 * archiveAccount) — visits, invoices and photos are kept so billing history
 * still renders.
 *
 * Owner-only; the caller gates rendering on role, and the
 * enforce_owner_only_archive trigger is the actual enforcement.
 */
export function DeleteAccountButton({
  accountId,
  accountName,
  propertyCount,
}: DeleteAccountButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await archiveAccount(accountId)
      if (res.error) {
        toast.error('Could not delete account', { description: res.error })
        return
      }
      toast.success(`Deleted ${accountName}`)
      router.push('/management/accounts')
    })
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Delete account"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title="Delete this account?"
      description={
        <>
          <span className="font-medium text-foreground">{accountName}</span> will be removed from
          accounts, the schedule, and route groups
          {propertyCount > 0 && (
            <>
              , along with{' '}
              <span className="font-medium text-foreground">
                {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
              </span>
            </>
          )}
          . Completed visits and invoices are kept for your records, and any work that hasn&apos;t
          been invoiced yet stays in the billing queue.
        </>
      }
      confirmLabel="Delete account"
      pending={pending}
      onConfirm={handleDelete}
    />
  )
}
