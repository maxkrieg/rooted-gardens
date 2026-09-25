'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, startOfYear, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncCustomer } from '@/lib/quickbooks/sync'
import { pushAccountInvoice } from '@/lib/quickbooks/invoice'
import { syncInvoiceStatus } from '@/lib/quickbooks/invoiceStatus'
import { groupVisitsByAccount } from '@/lib/utils/billing'
import type { Account, Invoice, InvoiceWithVisits, VisitWithLocation } from '@/types/app'

/**
 * Completed, uninvoiced per_visit visits, oldest first. Contract accounts bill by period, not
 * visit.
 */
/** Returns an error rather than [] so a failed load never reads as "nothing to invoice". */
interface LoadResult<T> {
  data: T
  loadError?: boolean
}

export async function getUninvoicedVisits(): Promise<LoadResult<VisitWithLocation[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .eq('status', 'completed')
    .is('invoice_id', null)
    .order('ended_at', { ascending: true })

  if (error) {
    console.error('[getUninvoicedVisits]', error)
    return { data: [], loadError: true }
  }

  return {
    data: ((data ?? []) as unknown as VisitWithLocation[]).filter(
      (v) => v.account.billing_type === 'per_visit',
    ),
  }
}

export interface PushResult {
  accountId: string
  accountName: string
  success: boolean
  qboInvoiceId?: string
  error?: string
}

/**
 * Pushes visits to QBO, one invoice per account. Re-groups server-side since this moves money.
 * Each group inserts its invoices row, then tags visits; a failed group never blocks the others.
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
    // Backstop for a legacy 'as_needed' row: refuse rather than price it off a null rate.
    if (group.account.billing_type !== 'per_visit' && group.account.billing_type !== 'contract') {
      results.push({
        accountId: group.account.id,
        accountName: group.account.name,
        success: false,
        error: 'This account has no per-visit rate — invoice it manually',
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

    const recordFailed = (): PushResult => ({
      accountId: group.account.id,
      accountName: group.account.name,
      success: false,
      error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
    })

    // Insert the invoices row first — the visit tag points at it.
    const isContract = group.account.billing_type === 'contract'
    const total = isContract
      ? Number(group.account.contract_rate)
      : Number(group.account.price_per_visit) * group.visits.length

    const { data: invoiceRow, error: insertError } = await supabase
      .from('invoices')
      .insert({
        qbo_invoice_id: invoiceRes.qboInvoiceId,
        account_id: group.account.id,
        billing_type: group.account.billing_type,
        amount: total,
      })
      .select('id')
      .single()

    if (insertError || !invoiceRow) {
      console.error('[pushInvoicesToQuickBooks] invoices insert', insertError)
      results.push(recordFailed())
      continue
    }

    // No per-line amount on the visit; History derives it as invoices.amount / visit count.
    const { error: updErr } = await supabase
      .from('visits')
      .update({ invoice_id: invoiceRow.id })
      .in(
        'id',
        group.visits.map((v) => v.id),
      )
    const invoiceUpdateFailed = Boolean(updErr)

    results.push(
      invoiceUpdateFailed
        ? recordFailed()
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

interface DateRange {
  start: Date
  end: Date
}

/** Invoices created in a date range, with account and visits, for the History tab. */
export async function getInvoicesForRange({
  start,
  end,
}: DateRange): Promise<LoadResult<InvoiceWithVisits[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*, account:accounts(*), visits:visits(*, property:properties(*))')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getInvoicesForRange]', error)
    return { data: [], loadError: true }
  }

  return { data: (data ?? []) as unknown as InvoiceWithVisits[] }
}

export interface RevenueSummary {
  mtd: { total: number; perVisit: number; contract: number; label: string }
  ytd: { total: number; perVisit: number; contract: number; label: string }
  /** True when the query failed, so the tiles can read "—" rather than "$0". */
  loadError?: boolean
}

/** MTD/YTD invoiced revenue by billing type, reduced in JS from one year-long query. */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const supabase = await createClient()
  const now = new Date()
  const yearStart = startOfYear(now)
  const monthStart = startOfMonth(now)
  const monthLabel = format(now, 'MMMM yyyy')
  const yearLabel = format(now, 'yyyy')
  const empty = { total: 0, perVisit: 0, contract: 0 }

  const { data, error } = await supabase
    .from('invoices')
    .select('billing_type, amount, created_at')
    .gte('created_at', yearStart.toISOString())

  if (error || !data) {
    console.error('[getRevenueSummary]', error)
    return {
      mtd: { ...empty, label: monthLabel },
      ytd: { ...empty, label: yearLabel },
      loadError: true,
    }
  }

  const mtd = { ...empty }
  const ytd = { ...empty }

  for (const row of data as { billing_type: string; amount: number | null; created_at: string }[]) {
    const amount = Number(row.amount ?? 0)
    const isContract = row.billing_type === 'contract'

    ytd.total += amount
    if (isContract) ytd.contract += amount
    else ytd.perVisit += amount

    if (new Date(row.created_at) >= monthStart) {
      mtd.total += amount
      if (isContract) mtd.contract += amount
      else mtd.perVisit += amount
    }
  }

  return { mtd: { ...mtd, label: monthLabel }, ytd: { ...ytd, label: yearLabel } }
}

/** Every active contract account with its latest contract invoice, for the Contracts tab. */
export interface ContractAccountOverview {
  account: Account
  lastInvoice: Invoice | null
}

export async function getContractAccountsOverview(): Promise<
  LoadResult<ContractAccountOverview[]>
> {
  const supabase = await createClient()

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('billing_type', 'contract')
    .eq('status', 'active')
    .eq('is_archived', false)
    .order('name')

  if (accountsError || !accounts) {
    console.error('[getContractAccountsOverview] accounts', accountsError)
    return { data: [], loadError: true }
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('billing_type', 'contract')
    .order('created_at', { ascending: false })

  if (invoicesError) {
    console.error('[getContractAccountsOverview] invoices', invoicesError)
  }

  const typedInvoices = (invoices ?? []) as unknown as Invoice[]

  return {
    data: accounts.map((account) => ({
      account,
      lastInvoice: typedInvoices.find((inv) => inv.account_id === account.id) ?? null,
    })),
  }
}

interface CreateContractInvoiceInput {
  accountId: string
  periodLabel: string
  periodStart: string // 'yyyy-MM-dd'
  periodEnd: string // 'yyyy-MM-dd'
  amount: number
}

interface CreateContractInvoiceResult {
  success: boolean
  qboInvoiceId?: string
  error?: string
}

/**
 * Invoices a contract account for a period, regardless of visits. Bills `input.amount`, which
 * may override the standing rate, then tags any completed visits in the period.
 */
export async function createContractInvoice(
  input: CreateContractInvoiceInput,
): Promise<CreateContractInvoiceResult> {
  const supabase = await createClient()

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', input.accountId)
    .single()

  if (accountError || !account) {
    return { success: false, error: 'Account not found' }
  }
  if (account.billing_type !== 'contract') {
    return { success: false, error: 'Not a contract account' }
  }

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return { success: false, error: 'Connect QuickBooks from the Billing page first' }
  }

  const syncRes = await syncCustomer(account.id)
  if (syncRes.error || !syncRes.qboCustomerId) {
    return { success: false, error: syncRes.error ?? 'Could not link QuickBooks customer' }
  }

  // Whatever completed visits fall in the period — for the invoice line's
  // description and for audit-trail tagging below. May be empty; that's fine.
  const { data: periodVisits } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .eq('account_id', account.id)
    .eq('status', 'completed')
    .gte('ended_at', input.periodStart)
    .lte('ended_at', input.periodEnd)

  const visits = (periodVisits ?? []) as unknown as VisitWithLocation[]

  const invoiceRes = await pushAccountInvoice(
    qbo,
    { ...account, qbo_customer_id: syncRes.qboCustomerId },
    visits,
    { amountOverride: input.amount },
  )
  if (invoiceRes.error || !invoiceRes.qboInvoiceId) {
    return { success: false, error: invoiceRes.error ?? 'Could not create QuickBooks invoice' }
  }

  const { data: invoiceRow, error: insertError } = await supabase
    .from('invoices')
    .insert({
      qbo_invoice_id: invoiceRes.qboInvoiceId,
      account_id: account.id,
      billing_type: 'contract',
      amount: input.amount,
      period_label: input.periodLabel,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    })
    .select('id')
    .single()

  if (insertError || !invoiceRow) {
    console.error('[createContractInvoice] insert', insertError)
    revalidatePath('/management/billing')
    return {
      success: false,
      error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
    }
  }

  if (visits.length > 0) {
    // Tag for audit-trail/UI consistency only — the real amount lives on the
    // invoices row just inserted above (a contract invoice isn't visit-driven).
    await supabase
      .from('visits')
      .update({ invoice_id: invoiceRow.id })
      .in(
        'id',
        visits.map((v) => v.id),
      )
      .is('invoice_id', null)
  }

  revalidatePath('/management/billing')
  return { success: true, qboInvoiceId: invoiceRes.qboInvoiceId }
}

interface RefreshInvoiceStatusesResult {
  processed: number
  errors: number
  /** Which invoices failed — a bare "3 failed" left nothing to act on. */
  failedInvoiceIds?: string[]
  /** Set when the whole run failed for one shared reason (e.g. disconnected). */
  reason?: string
}

/** Manual "Refresh now": syncs QBO status for the given invoices under the user's RLS client. */
export async function refreshInvoiceStatuses(
  invoiceIds: string[],
): Promise<RefreshInvoiceStatusesResult> {
  if (invoiceIds.length === 0) return { processed: 0, errors: 0 }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('id, qbo_invoice_id, sent_at, paid_at')
    .in('id', invoiceIds)

  if (error || !data) {
    console.error('[refreshInvoiceStatuses] select', error)
    return { processed: 0, errors: 0 }
  }

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return {
      processed: 0,
      errors: data.length,
      reason: 'QuickBooks is not connected. Reconnect it from this page, then refresh again.',
    }
  }

  let processed = 0
  const failedInvoiceIds: string[] = []
  for (const row of data) {
    const res = await syncInvoiceStatus(supabase, qbo, row)
    if (res.error) failedInvoiceIds.push(row.qbo_invoice_id)
    else processed++
  }

  revalidatePath('/management/billing')
  return { processed, errors: failedInvoiceIds.length, failedInvoiceIds }
}

/** The background poll skips invoices synced more recently than this. */
const POLL_STALENESS_MS = 45_000

/**
 * Background History refresh: syncs unpaid invoices not synced within POLL_STALENESS_MS, so it's
 * safe to call often. Silent; returns how many synced.
 */
export async function pollInvoiceStatuses(invoiceIds: string[]): Promise<{ synced: number }> {
  if (invoiceIds.length === 0) return { synced: 0 }

  const supabase = await createClient()
  const staleBefore = new Date(Date.now() - POLL_STALENESS_MS).toISOString()

  const { data, error } = await supabase
    .from('invoices')
    .select('id, qbo_invoice_id, sent_at, paid_at')
    .in('id', invoiceIds)
    .neq('status', 'paid')
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)

  if (error || !data || data.length === 0) return { synced: 0 }

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return { synced: 0 } // QBO not connected — stay silent, cron/manual will catch up
  }

  let synced = 0
  for (const row of data) {
    const res = await syncInvoiceStatus(supabase, qbo, row)
    if (!res.error) synced++
  }

  if (synced > 0) revalidatePath('/management/billing')
  return { synced }
}
