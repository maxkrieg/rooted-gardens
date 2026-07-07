'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { QboStatusBadge } from '@/components/management/badges'
import type { QboConnectionStatus } from '@/lib/quickbooks/client'

const REASON_MESSAGES: Record<string, string> = {
  forbidden: 'Only an owner can connect QuickBooks.',
  denied: 'QuickBooks connection was cancelled.',
  state_mismatch: 'QuickBooks connection could not be verified — please try again.',
  token_exchange_failed: 'QuickBooks did not accept the connection — please try again.',
  store_failed: 'Connected, but saving the connection failed — please try again.',
}

interface QuickBooksConnectProps {
  status: QboConnectionStatus
  canManage: boolean
  feedback?: { qbo: string; reason?: string }
}

/** Connection status + "Connect QuickBooks" trigger for the billing page.
 *  The button is a plain anchor (not a Link or Server Action) — it's a full
 *  top-level navigation to a Route Handler that immediately redirects to
 *  Intuit, not client-side routing. */
export function QuickBooksConnect({ status, canManage, feedback }: QuickBooksConnectProps) {
  useEffect(() => {
    if (!feedback) return
    if (feedback.qbo === 'connected') {
      toast.success('QuickBooks connected')
    } else if (feedback.qbo === 'error') {
      toast.error(REASON_MESSAGES[feedback.reason ?? ''] ?? 'QuickBooks connection failed')
    }
    // Only meant to fire once per redirect back from the OAuth flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">QuickBooks</span>
      <QboStatusBadge status={status} />
      {canManage && status !== 'connected' && (
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <a href="/api/quickbooks/connect">Connect QuickBooks</a>
        </Button>
      )}
    </div>
  )
}
