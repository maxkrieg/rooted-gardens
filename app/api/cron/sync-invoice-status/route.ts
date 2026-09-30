import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncPendingInvoices } from '@/lib/quickbooks/invoiceStatus'
import { reportError } from '@/lib/observability/report'

/**
 * Daily Vercel Cron that syncs QBO invoice status (Hobby allows daily only; "Refresh now" covers
 * the urgent case). Requires CRON_SECRET, failing closed; uses the service client.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A Sentry Cron Monitor: alerts when the sync throws *or never runs* (a failing Vercel cron is
  // otherwise silent on Hobby). The monitor is created on the first check-in; the schedule must
  // match vercel.json. Hobby fires any time within the scheduled hour, hence the wide margin.
  const response = await Sentry.withMonitor(
    'sync-invoice-status',
    async () => {
      const supabase = createServiceClient()

      let qbo
      try {
        qbo = await getQuickBooksClient()
      } catch (err) {
        // QBO not connected is an expected, recoverable state (matches how the
        // billing actions treat it) — 200 so Vercel doesn't flag the cron as failing.
        // Still a warning: every day it lasts, invoice status goes stale.
        reportError(err, '[cron/sync-invoice-status] QuickBooks not connected', {
          level: 'warning',
          message: 'QuickBooks is not connected; invoice status sync skipped',
        })
        return NextResponse.json({ ok: false, error: 'QuickBooks not connected' })
      }

      const result = await syncPendingInvoices(supabase, qbo, { limit: 50 })
      return NextResponse.json({ ok: true, ...result })
    },
    {
      schedule: { type: 'crontab', value: '0 9 * * *' },
      timezone: 'Etc/UTC',
      checkinMargin: 90,
      maxRuntime: 5,
    },
  )

  // Serverless can freeze before the check-in leaves the process.
  await Sentry.flush(2000)
  return response
}
