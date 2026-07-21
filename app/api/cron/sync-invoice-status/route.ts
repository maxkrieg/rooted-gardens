import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncPendingInvoices } from '@/lib/quickbooks/invoiceStatus'

/**
 * Daily Vercel Cron (see vercel.json) that pulls QBO invoice lifecycle status
 * back into the `invoices` table. The Hobby plan only allows daily cron, so this
 * is the safety-net refresh; the immediate case (an accountant sending an
 * invoice from inside QBO and wanting to confirm it) is covered by the manual
 * "Refresh now" action on the Billing → History tab.
 *
 * Authenticated by CRON_SECRET (Vercel injects `Authorization: Bearer <secret>`
 * automatically when the env var is set). Fails closed if the secret is unset.
 * Uses the service-role client — this is unattended, with no user session — the
 * exact use case createServiceClient documents.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    // QBO not connected is an expected, recoverable state (matches how the
    // billing actions treat it) — 200 so Vercel doesn't flag the cron as failing.
    return NextResponse.json({ ok: false, error: 'QuickBooks not connected' })
  }

  const result = await syncPendingInvoices(supabase, qbo, { limit: 50 })
  return NextResponse.json({ ok: true, ...result })
}
