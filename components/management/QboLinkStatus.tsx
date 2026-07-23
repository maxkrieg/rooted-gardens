'use client'

import { useTransition } from 'react'
import { CheckCircle2, ExternalLink, Link2Off } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { syncAccountWithQuickBooks } from '@/app/management/accounts/actions'
import { qboCustomerUrl } from '@/lib/utils/billing'

interface QboLinkStatusProps {
  accountId: string
  qboCustomerId: string | null
}

/** QuickBooks link status + "Link / Sync" trigger for the account detail
 *  page. Create-vs-update is decided server-side (syncCustomer) based on
 *  whether qbo_customer_id is already set — once linked, every click pushes
 *  the account's current name/email/phone/billing address to QBO. */
export function QboLinkStatus({ accountId, qboCustomerId }: QboLinkStatusProps) {
  const [pending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const res = await syncAccountWithQuickBooks(accountId)
      if (res.error) {
        toast.error('QuickBooks sync failed', { description: res.error })
      } else if (res.action === 'recreated') {
        toast.warning('Reconnected to QuickBooks', {
          description: 'The previous link was invalid — a new QuickBooks customer was created.',
        })
      } else if (res.action === 'updated') {
        toast.success('QuickBooks customer updated')
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
          <a
            href={qboCustomerUrl(qboCustomerId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline ml-2 shrink-0"
          >
            View in QuickBooks
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
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
        {pending ? (qboCustomerId ? 'Syncing…' : 'Linking…') : qboCustomerId ? 'Sync' : 'Link to QuickBooks'}
      </Button>
    </div>
  )
}
