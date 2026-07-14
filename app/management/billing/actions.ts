'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth, startOfYear, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getQuickBooksClient } from '@/lib/quickbooks/client'
import { syncCustomer } from '@/lib/quickbooks/sync'
import { pushAccountInvoice } from '@/lib/quickbooks/invoice'
import { groupVisitsByAccountMonth } from '@/lib/utils/billing'
import type { Account, ContractInvoiceWithAccount, VisitWithLocation } from '@/types/app'

/**
 * All completed, not-yet-invoiced visits, joined to property + account —
 * every uninvoiced visit regardless of month, so nothing sitting in an old
 * month goes unnoticed (the Queue groups these by month for display; see
 * groupVisitsByAccountMonth). Filters on `status`/`invoiced_at` only, hitting
 * the existing `visits_uninvoiced_idx` partial index
 * (`WHERE status='completed' AND invoiced_at IS NULL`). Ordered oldest-first
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
    .is('invoiced_at', null)
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
 * line per visit for per_visit accounts, one flat-rate summary line for
 * contract accounts). The owner invoices monthly, so a push must never
 * combine two different months' visits into one invoice — grouping by month
 * as well as account is what guarantees that, regardless of what the
 * accountant happens to select in one batch. Re-fetches and re-groups the
 * visits server-side rather than trusting client-supplied grouping, since
 * this is a money-moving operation.
 *
 * Per group, not all-or-nothing across the batch: each group's own visits
 * update is a single atomic statement, and one group failing (missing rate,
 * QBO rejecting the invoice, etc.) never blocks or rolls back another
 * group's push in the same batch.
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
            monthLabel: group.monthLabel,
            success: false,
            error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
          }
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
  mtd: { total: number; perVisit: number; contract: number; label: string }
  ytd: { total: number; perVisit: number; contract: number; label: string }
}

/**
 * MTD/YTD invoiced revenue, split by billing type (task 5.6). Pulls the whole
 * calendar year in one query (small volume at this company's scale) and
 * reduces both windows in JS rather than round-tripping twice.
 *
 * Contract revenue is summed from two sources with no double-counting risk:
 * `contract_invoices` (the authoritative record for every contract invoice
 * created via the Contracts tab, going forward) plus any `visits.invoice_amount`
 * tagged before that feature existed (historical contract pushes from the old
 * Queue-driven flow). New contract visits are always tagged `invoice_amount = 0`
 * (see createContractInvoice), so they never contribute here.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  const supabase = await createClient()
  const now = new Date()
  const yearStart = startOfYear(now)
  const monthStart = startOfMonth(now)
  const monthLabel = format(now, 'MMMM yyyy')
  const yearLabel = format(now, 'yyyy')
  const empty = { total: 0, perVisit: 0, contract: 0 }

  const [visitsRes, contractInvoicesRes] = await Promise.all([
    supabase
      .from('visits')
      .select('invoice_amount, invoiced_at, account:accounts(billing_type)')
      .not('invoiced_at', 'is', null)
      .gte('invoiced_at', yearStart.toISOString()),
    supabase
      .from('contract_invoices')
      .select('amount, invoiced_at')
      .gte('invoiced_at', yearStart.toISOString()),
  ])

  if (visitsRes.error || !visitsRes.data) {
    console.error('[getRevenueSummary] visits', visitsRes.error)
    return { mtd: { ...empty, label: monthLabel }, ytd: { ...empty, label: yearLabel } }
  }
  if (contractInvoicesRes.error) {
    console.error('[getRevenueSummary] contract_invoices', contractInvoicesRes.error)
  }

  const mtd = { ...empty }
  const ytd = { ...empty }

  for (const row of visitsRes.data as unknown as {
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

  for (const row of contractInvoicesRes.data ?? []) {
    const amount = Number(row.amount)
    ytd.total += amount
    ytd.contract += amount
    if (new Date(row.invoiced_at) >= monthStart) {
      mtd.total += amount
      mtd.contract += amount
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
  lastInvoice: ContractInvoiceWithAccount | null
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
    .from('contract_invoices')
    .select('*, account:accounts(*)')
    .order('invoiced_at', { ascending: false })

  if (invoicesError) {
    console.error('[getContractAccountsOverview] invoices', invoicesError)
  }

  const typedInvoices = (invoices ?? []) as unknown as ContractInvoiceWithAccount[]

  return accounts.map((account) => ({
    account,
    lastInvoice: typedInvoices.find((inv) => inv.account_id === account.id) ?? null,
  }))
}

/** Contract invoices for a given month (`yyyy-MM`), joined to account — the
 *  Invoiced tab's contract rows (merged with per_visit InvoiceGroups there). */
export async function getContractInvoicesForMonth(month: string): Promise<ContractInvoiceWithAccount[]> {
  const supabase = await createClient()
  const monthStart = startOfMonth(new Date(`${month}-01T00:00:00`))
  const monthEnd = endOfMonth(monthStart)

  const { data, error } = await supabase
    .from('contract_invoices')
    .select('*, account:accounts(*)')
    .gte('invoiced_at', monthStart.toISOString())
    .lte('invoiced_at', monthEnd.toISOString())
    .order('invoiced_at', { ascending: false })

  if (error) {
    console.error('[getContractInvoicesForMonth]', error)
    return []
  }

  return (data ?? []) as unknown as ContractInvoiceWithAccount[]
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
 * Bills `input.amount`, not `account.contract_rate` — the dialog prefills
 * with the account's standing rate, but the owner can override it to bill a
 * one-off amount without changing the account's rate. Reuses
 * pushAccountInvoice's `amountOverride` option; it already builds a single
 * flat-rate line for `billing_type === 'contract'` using visits only for the
 * line description, so it works correctly with an empty visits array.
 *
 * `contract_invoices` is the authoritative revenue record (not the visits
 * tagged below) — see getRevenueSummary's doc comment for why that avoids
 * double-counting.
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

  const now = new Date().toISOString()

  const { error: insertError } = await supabase.from('contract_invoices').insert({
    account_id: account.id,
    period_label: input.periodLabel,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    amount: input.amount,
    qbo_invoice_id: invoiceRes.qboInvoiceId,
    invoiced_at: now,
  })

  if (visits.length > 0) {
    // Tag for audit-trail/UI consistency only — invoice_amount is 0 since the
    // real amount lives on the contract_invoices row just inserted above.
    await supabase
      .from('visits')
      .update({ invoiced_at: now, qbo_invoice_id: invoiceRes.qboInvoiceId, invoice_amount: 0 })
      .in(
        'id',
        visits.map((v) => v.id),
      )
      .is('invoiced_at', null)
  }

  revalidatePath('/management/billing')

  if (insertError) {
    console.error('[createContractInvoice] insert', insertError)
    return {
      success: false,
      error: `Invoice ${invoiceRes.qboInvoiceId} created in QuickBooks but could not be recorded locally — record it manually`,
    }
  }

  return { success: true, qboInvoiceId: invoiceRes.qboInvoiceId }
}
