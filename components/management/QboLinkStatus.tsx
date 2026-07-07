'use client'

import { useTransition } from 'react'
import { CheckCircle2, Link2, Link2Off } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { syncAccountWithQuickBooks } from '@/app/management/accounts/actions'

interface QboLinkStatusProps {
  accountId: string
  qboCustomerId: string | null
}

/** QuickBooks link status + "Link / Refresh" trigger for the account detail
 *  page. Create-vs-verify is decided server-side (syncCustomer) based on
 *  whether qbo_customer_id is already set. */
export function QboLinkStatus({ accountId, qboCustomerId }: QboLinkStatusProps) {
  const [pending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const res = await syncAccountWithQuickBooks(accountId)
      if (res.error) {
        toast.error('QuickBooks sync failed', { description: res.error })
      } else if (res.recreated) {
        toast.warning('Reconnected to QuickBooks', {
          description: 'The previous link was invalid — a new QuickBooks customer was created.',
        })
      } else {
        toast.success('Linked to QuickBooks')
      }
    })
  }

  return (
    <div className="flex items-center gap-2 border-t border-border pt-3">
      {qboCustomerId ? (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2f6e45]" />
          <span className="text-sm text-[#2f6e45] font-medium">Linked to QuickBooks</span>
          <span className="text-sm text-muted-foreground font-mono ml-1">· {qboCustomerId}</span>
        </>
      ) : (
        <>
          <Link2Off className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Not linked to QuickBooks</span>
        </>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs ml-auto shrink-0"
        disabled={pending}
        onClick={handleSync}
      >
        {pending ? (qboCustomerId ? 'Refreshing…' : 'Linking…') : qboCustomerId ? 'Refresh' : 'Link to QuickBooks'}
      </Button>
      {qboCustomerId && <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    </div>
  )
}
