import { format, parseISO } from 'date-fns'
import type { Account, VisitWithLocation } from '@/types/app'

export type AccountMonthGroup = {
  account: Account
  monthKey: string // 'yyyy-MM', from the visit's completion date
  monthLabel: string // 'May 2026'
  visits: VisitWithLocation[]
}

function completionMonthKey(visit: VisitWithLocation): string {
  return format(parseISO(visit.ended_at ?? visit.week_start), 'yyyy-MM')
}

/**
 * Clusters uninvoiced visits by (account, completion month) — the owner invoices
 * monthly, so a push must never combine two different months' visits into one
 * invoice (that would under-bill a contract account, whose flat rate is per
 * period, not per push). Sorted oldest-month-first, then by account name, so
 * the Queue can render one flat list and drop a divider whenever `monthKey`
 * changes between consecutive groups, with no separate nested structure.
 */
export function groupVisitsByAccountMonth(visits: VisitWithLocation[]): AccountMonthGroup[] {
  const map = new Map<string, AccountMonthGroup>()
  for (const visit of visits) {
    const monthKey = completionMonthKey(visit)
    const key = `${visit.account.id}::${monthKey}`
    const existing = map.get(key)
    if (existing) {
      existing.visits.push(visit)
    } else {
      map.set(key, {
        account: visit.account,
        monthKey,
        monthLabel: format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
        visits: [visit],
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    a.monthKey !== b.monthKey
      ? a.monthKey.localeCompare(b.monthKey)
      : a.account.name.localeCompare(b.account.name),
  )
}

export type InvoiceGroup = {
  account: Account
  qboInvoiceId: string
  invoicedAt: string
  visits: VisitWithLocation[]
  totalAmount: number
}

/**
 * Clusters invoiced visits by the actual QBO invoice they belong to (not by
 * account alone — an account can be pushed more than once in a month, and the
 * audit trail needs to keep those as distinct invoices). `totalAmount` is a
 * plain sum of `invoice_amount` across the group: correct for every billing
 * type with no special-casing, since the contract snapshot convention (see
 * pushInvoicesToQuickBooks) already puts the full contract_rate on exactly one
 * visit per invoice and 0 on the rest.
 */
export function groupVisitsByInvoice(visits: VisitWithLocation[]): InvoiceGroup[] {
  const map = new Map<string, InvoiceGroup>()
  for (const visit of visits) {
    if (!visit.qbo_invoice_id || !visit.invoiced_at) continue
    const amount = Number(visit.invoice_amount ?? 0)
    const existing = map.get(visit.qbo_invoice_id)
    if (existing) {
      existing.visits.push(visit)
      existing.totalAmount += amount
    } else {
      map.set(visit.qbo_invoice_id, {
        account: visit.account,
        qboInvoiceId: visit.qbo_invoice_id,
        invoicedAt: visit.invoiced_at,
        visits: [visit],
        totalAmount: amount,
      })
    }
  }
  return [...map.values()].sort((a, b) => (a.invoicedAt < b.invoicedAt ? 1 : -1))
}
