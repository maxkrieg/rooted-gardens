'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncCustomer } from '@/lib/quickbooks/sync'
import { pushAccountInvoice } from '@/lib/quickbooks/invoice'
import { groupVisitsByAccount } from '@/lib/utils/billing'
import type { VisitWithLocation } from '@/types/app'

/**
 * Completed, not-yet-invoiced visits for a given month (`yyyy-MM`), joined to
 * property + account. Filters on `ended_at` — a visit only reaches
 * `status='completed'` through the completion flow, which always writes
 * `ended_at` — and hits the existing `visits_uninvoiced_idx` partial index
 * (`WHERE status='completed' AND invoiced_at IS NULL`).
 */
export async function getUninvoicedVisits(month: string): Promise<VisitWithLocation[]> {
  const supabase = await createClient()
  const monthStart = startOfMonth(new Date(`${month}-01T00:00:00`))
  const monthEnd = endOfMonth(monthStart)

  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .eq('status', 'completed')
    .is('invoiced_at', null)
    .gte('ended_at', monthStart.toISOString())
    .lte('ended_at', monthEnd.toISOString())
    .order('ended_at', { ascending: true })

  if (error) {
    console.error('[getUninvoicedVisits]', error)
    return []
  }

  return (data ?? []) as unknown as VisitWithLocation[]
}

export interface PushResult {
  accountId: string
  accountName: string
  success: boolean
  qboInvoiceId?: string
  error?: string
}

/**
 * Pushes the selected visits to QuickBooks as real invoices, grouped by
 * account — one QBO Invoice per account (one line per visit for per_visit
 * accounts, one flat-rate summary line for contract accounts). Re-fetches and
 * re-groups the visits server-side rather than trusting client-supplied
 * grouping, since this is a money-moving operation.
 *
 * Per-account, not all-or-nothing across the batch: each account's own visits
 * update is a single atomic statement, and one account failing (missing rate,
 * QBO rejecting the invoice, etc.) never blocks or rolls back another
 * account's push in the same batch.
 */
export async function pushInvoicesToQuickBooks(visitIds: string[]): Promise<PushResult[]> {
  if (visitIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .in('id', visitIds)

  if (error || !data) {
    console.error('[pushInvoicesToQuickBooks] fetch', error)
    return [
      {
        accountId: '',
        accountName: 'Selected visits',
        success: false,
        error: 'Could not load selected visits',
      },
    ]
  }

  const groups = groupVisitsByAccount(data as unknown as VisitWithLocation[])

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return groups.map((g) => ({
      accountId: g.account.id,
      accountName: g.account.name,
      success: false,
      error: 'Connect QuickBooks from the Billing page first',
    }))
  }

  const results: PushResult[] = []

  for (const group of groups) {
    if (group.account.billing_type === 'as_needed') {
      results.push({
        accountId: group.account.id,
        accountName: group.account.name,
        success: false,
        error: 'as_needed accounts have no set rate — invoice manually',
      })
      continue
    }

    const syncRes = await syncCustomer(group.account.id)
    if (syncRes.error || !syncRes.qboCustomerId) {
      results.push({
        accountId: group.account.id,
        accountName: group.account.name,
        success: false,
        error: syncRes.error ?? 'Could not link QuickBooks customer',
      })
      continue
    }

    const invoiceRes = await pushAccountInvoice(
      qbo,
      { ...group.account, qbo_customer_id: syncRes.qboCustomerId },
      group.visits,
    )
    if (invoiceRes.error || !invoiceRes.qboInvoiceId) {
      results.push({
        accountId: group.account.id,
        accountName: group.account.name,
        success: false,
        error: invoiceRes.error ?? 'Could not create QuickBooks invoice',
      })
      continue
    }

    const { error: updateError } = await supabase
      .from('visits')
      .update({ invoiced_at: new Date().toISOString(), qbo_invoice_id: invoiceRes.qboInvoiceId })
      .in(
        'id',
        group.visits.map((v) => v.id),
      )

    results.push(
      updateError
        ? {
            accountId: group.account.id,
            accountName: group.account.name,
            success: false,
            error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
          }
        : {
            accountId: group.account.id,
            accountName: group.account.name,
            success: true,
            qboInvoiceId: invoiceRes.qboInvoiceId,
          },
    )
  }

  revalidatePath('/management/billing')
  return results
}
