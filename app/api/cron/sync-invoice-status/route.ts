import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncPendingInvoices } from '@/lib/quickbooks/invoiceStatus'

/**
 * Daily Vercel Cron that syncs QBO invoice status (Hobby allows daily only; "Refresh now" covers
 * the urgent case). Requires CRON_SECRET, failing closed; uses the service client.
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
