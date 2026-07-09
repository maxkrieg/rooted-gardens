'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth, startOfYear } from 'date-fns'
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

    // Snapshot invoice_amount (task 5.6): per_visit gets each visit's own
    // price; contract's flat rate can't be split per visit, so the batch's
    // first visit gets the full contract_rate and the rest get 0 — this keeps
    // any downstream SUM(invoice_amount) correct for both billing types with
    // no special-casing (see lib/utils/billing.ts's groupVisitsByInvoice).
    const now = new Date().toISOString()
    let invoiceUpdateFailed = false

    if (group.account.billing_type === 'contract') {
      const [first, ...rest] = group.visits
      const { error: firstErr } = await supabase
        .from('visits')
        .update({
          invoiced_at: now,
          qbo_invoice_id: invoiceRes.qboInvoiceId,
          invoice_amount: group.account.contract_rate,
        })
        .eq('id', first.id)
      if (firstErr) invoiceUpdateFailed = true

      if (!firstErr && rest.length > 0) {
        const { error: restErr } = await supabase
          .from('visits')
          .update({ invoiced_at: now, qbo_invoice_id: invoiceRes.qboInvoiceId, invoice_amount: 0 })
          .in(
            'id',
            rest.map((v) => v.id),
          )
        if (restErr) invoiceUpdateFailed = true
      }
    } else {
      const { error } = await supabase
        .from('visits')
        .update({
          invoiced_at: now,
          qbo_invoice_id: invoiceRes.qboInvoiceId,
          invoice_amount: group.account.price_per_visit,
        })
        .in(
          'id',
          group.visits.map((v) => v.id),
        )
      if (error) invoiceUpdateFailed = true
    }

    results.push(
      invoiceUpdateFailed
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

/**
 * Invoiced visits for a given month (`yyyy-MM`) — the mirror image of
 * getUninvoicedVisits, filtered on `invoiced_at` instead of `ended_at`. Backs
 * the Billing page's "Invoiced" audit-trail view (task 5.5).
 */
export async function getInvoicedVisits(month: string): Promise<VisitWithLocation[]> {
  const supabase = await createClient()
  const monthStart = startOfMonth(new Date(`${month}-01T00:00:00`))
  const monthEnd = endOfMonth(monthStart)

  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .not('invoiced_at', 'is', null)
    .gte('invoiced_at', monthStart.toISOString())
    .lte('invoiced_at', monthEnd.toISOString())
    .order('invoiced_at', { ascending: false })

  if (error) {
    console.error('[getInvoicedVisits]', error)
    return []
  }

  return (data ?? []) as unknown as VisitWithLocation[]
}

export interface RevenueSummary {
  mtd: { total: number; perVisit: number; contract: number }
  ytd: { total: number; perVisit: number; contract: number }
}

/**
 * MTD/YTD invoiced revenue, split by billing type (task 5.6). Pulls the whole
 * calendar year in one query (small volume at this company's scale) and
 * reduces both windows in JS rather than round-tripping twice.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const supabase = await createClient()
  const now = new Date()
  const yearStart = startOfYear(now)
  const monthStart = startOfMonth(now)
  const empty = { total: 0, perVisit: 0, contract: 0 }

  const { data, error } = await supabase
    .from('visits')
    .select('invoice_amount, invoiced_at, account:accounts(billing_type)')
    .not('invoiced_at', 'is', null)
    .gte('invoiced_at', yearStart.toISOString())

  if (error || !data) {
    console.error('[getRevenueSummary]', error)
    return { mtd: { ...empty }, ytd: { ...empty } }
  }

  const mtd = { ...empty }
  const ytd = { ...empty }

  for (const row of data as unknown as {
    invoice_amount: number | null
    invoiced_at: string
    account: { billing_type: string } | null
  }[]) {
    const amount = Number(row.invoice_amount ?? 0)
    const isContract = row.account?.billing_type === 'contract'

    ytd.total += amount
    if (isContract) ytd.contract += amount
    else ytd.perVisit += amount

    if (new Date(row.invoiced_at) >= monthStart) {
      mtd.total += amount
      if (isContract) mtd.contract += amount
      else mtd.perVisit += amount
    }
  }

  return { mtd, ytd }
}
