'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, startOfYear, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncCustomer } from '@/lib/quickbooks/sync'
import { pushAccountInvoice } from '@/lib/quickbooks/invoice'
import { syncInvoiceStatus } from '@/lib/quickbooks/invoiceStatus'
import { groupVisitsByAccountMonth } from '@/lib/utils/billing'
import type { Account, Invoice, InvoiceWithVisits, VisitWithLocation } from '@/types/app'

/**
 * All completed, not-yet-invoiced visits, joined to property + account —
 * every uninvoiced visit regardless of month, so nothing sitting in an old
 * month goes unnoticed (the Queue groups these by month for display; see
 * groupVisitsByAccountMonth). Filters on `status`/`invoice_id` only, hitting
 * the `visits_uninvoiced_idx` partial index
 * (`WHERE status='completed' AND invoice_id IS NULL`). Ordered oldest-first
 * — the oldest unbilled work is the most overdue/actionable.
 *
 * Excludes `contract` accounts — they're billed a flat rate per period
 * regardless of visit count/activity, so a visit-completion-driven queue is
 * the wrong trigger for them (see docs/INVOICING.md). Contract invoicing
 * happens from the Contracts tab (`createContractInvoice`) instead.
 */
export async function getUninvoicedVisits(): Promise<VisitWithLocation[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .eq('status', 'completed')
    .is('invoice_id', null)
    .order('ended_at', { ascending: true })

  if (error) {
    console.error('[getUninvoicedVisits]', error)
    return []
  }

  return ((data ?? []) as unknown as VisitWithLocation[]).filter(
    (v) => v.account.billing_type !== 'contract',
  )
}

export interface PushResult {
  accountId: string
  accountName: string
  monthLabel: string
  success: boolean
  qboInvoiceId?: string
  error?: string
}

/**
 * Pushes the selected visits to QuickBooks as real invoices, grouped by
 * (account, completion month) — one QBO Invoice per account per month (one
 * line per visit for per_visit accounts). The owner invoices monthly, so a
 * push must never combine two different months' visits into one invoice —
 * grouping by month as well as account is what guarantees that, regardless of
 * what the accountant selects in one batch. Re-fetches and re-groups the visits
 * server-side rather than trusting client-supplied grouping, since this is a
 * money-moving operation.
 *
 * On success each group inserts one row into the canonical `invoices` table
 * (the record the History tab and status-sync read), then tags its visits with
 * that `invoice_id`. The invoices insert comes first because the visit tag now
 * points at it — so a failed insert fails the whole group (the invoice exists in
 * QBO but can't be recorded locally; same actionable error as before, just now
 * the primary failure path).
 *
 * Per group, not all-or-nothing across the batch: one group failing never
 * blocks or rolls back another group's push in the same batch.
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
        monthLabel: '',
        success: false,
        error: 'Could not load selected visits',
      },
    ]
  }

  const groups = groupVisitsByAccountMonth(data as unknown as VisitWithLocation[])

  let qbo
  try {
    qbo = await getQuickBooksClient()
  } catch {
    return groups.map((g) => ({
      accountId: g.account.id,
      accountName: g.account.name,
      monthLabel: g.monthLabel,
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
        monthLabel: group.monthLabel,
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
        monthLabel: group.monthLabel,
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
        monthLabel: group.monthLabel,
        success: false,
        error: invoiceRes.error ?? 'Could not create QuickBooks invoice',
      })
      continue
    }

    const recordFailed = (): PushResult => ({
      accountId: group.account.id,
      accountName: group.account.name,
      monthLabel: group.monthLabel,
      success: false,
      error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
    })

    // Insert the canonical invoices row first (the visit tag points at it).
    // Contract accounts don't reach the Queue, so this is effectively per_visit;
    // the contract branch below is a defensive backstop for a legacy contract
    // visit that somehow lands here.
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

    // Tag the visits with the invoice they were billed on. The per-line dollar
    // amount isn't stored on the visit — the History tab derives it as
    // invoices.amount / visit count (every per_visit line is billed at the same
    // price, so that's exact and stays a point-in-time snapshot).
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
            monthLabel: group.monthLabel,
            success: true,
            qboInvoiceId: invoiceRes.qboInvoiceId,
          },
    )
  }

  revalidatePath('/management/billing')
  return results
}

export interface DateRange {
  start: Date
  end: Date
}

/**
 * Every invoice created in a date range, joined to its account and the visits it
 * billed — the invoices-primary source for the Billing "History" tab. Range
 * filters on `invoices.created_at` (a real top-level column — the "invoiced"
 * moment), and one nested embed brings the account + per-visit detail rows along
 * in a single query. For contract invoices the embedded visits are just the
 * cosmetically-tagged ones and aren't rendered.
 */
export async function getInvoicesForRange({
  start,
  end,
}: DateRange): Promise<InvoiceWithVisits[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*, account:accounts(*), visits:visits(*, property:properties(*))')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getInvoicesForRange]', error)
    return []
  }

  return (data ?? []) as unknown as InvoiceWithVisits[]
}

export interface RevenueSummary {
  mtd: { total: number; perVisit: number; contract: number; label: string }
  ytd: { total: number; perVisit: number; contract: number; label: string }
}

/**
 * MTD/YTD invoiced revenue, split by billing type. Reads the canonical
 * `invoices` table directly — `amount` is always the single total per invoice,
 * so there's no double-counting to guard against (unlike the old split between
 * visits.invoice_amount and contract_invoices). Pulls the whole calendar year in
 * one query (small volume at this company's scale) and reduces both windows in JS.
 */
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
    return { mtd: { ...empty, label: monthLabel }, ytd: { ...empty, label: yearLabel } }
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

/**
 * Every active contract account paired with its most recent contract invoice
 * (or null if never invoiced) — backs the Contracts tab. Unlike the Queue,
 * this always lists every contract account regardless of visit activity,
 * since contract billing isn't visit-driven (see docs/INVOICING.md).
 */
export interface ContractAccountOverview {
  account: Account
  lastInvoice: Invoice | null
}

export async function getContractAccountsOverview(): Promise<ContractAccountOverview[]> {
  const supabase = await createClient()

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('billing_type', 'contract')
    .eq('status', 'active')
    .order('name')

  if (accountsError || !accounts) {
    console.error('[getContractAccountsOverview] accounts', accountsError)
    return []
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

  return accounts.map((account) => ({
    account,
    lastInvoice: typedInvoices.find((inv) => inv.account_id === account.id) ?? null,
  }))
}

export interface CreateContractInvoiceInput {
  accountId: string
  periodLabel: string
  periodStart: string // 'yyyy-MM-dd'
  periodEnd: string // 'yyyy-MM-dd'
  amount: number
}

export interface CreateContractInvoiceResult {
  success: boolean
  qboInvoiceId?: string
  error?: string
}

/**
 * Creates an ad-hoc invoice for a contract account, independent of visit
 * activity — a period with zero completed visits still owes the flat rate.
 * Bills `input.amount`, not `account.contract_rate` — the dialog prefills with
 * the account's standing rate, but the owner can override it to bill a one-off
 * amount without changing the account's rate. Reuses pushAccountInvoice's
 * `amountOverride` option.
 *
 * Inserts one row into the canonical `invoices` table (with the period_* fields),
 * then tags any completed visits in the period with that `invoice_id` (the amount
 * lives on the invoice row — a contract invoice isn't visit-driven).
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

export interface RefreshInvoiceStatusesResult {
  processed: number
  errors: number
}

/**
 * Manual "Refresh now" — pulls current QBO status for a specific set of invoices
 * on demand (the History tab's currently-visible rows), so the accountant can
 * confirm an invoice went out right after sending it from inside QuickBooks,
 * without waiting for the daily cron. Runs under the authenticated user's RLS
 * client (permitted by the invoices_update policy) and reuses the same
 * per-invoice sync logic as the cron.
 */
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
    return { processed: 0, errors: data.length }
  }

  let processed = 0
  let errors = 0
  for (const row of data) {
    const res = await syncInvoiceStatus(supabase, qbo, row)
    if (res.error) errors++
    else processed++
  }

  revalidatePath('/management/billing')
  return { processed, errors }
}
