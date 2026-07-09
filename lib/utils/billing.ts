import type { Account, VisitWithLocation } from '@/types/app'

export type AccountInvoiceGroup = {
  account: Account
  visits: VisitWithLocation[]
}

/**
 * Clusters uninvoiced visits by account, alphabetically — the billing page groups
 * per_visit accounts as individual lines and contract accounts as one summary line
 * per group (see components/management/InvoiceQueue.tsx).
 */
export function groupVisitsByAccount(visits: VisitWithLocation[]): AccountInvoiceGroup[] {
  const map = new Map<string, AccountInvoiceGroup>()
  for (const visit of visits) {
    const existing = map.get(visit.account.id)
    if (existing) {
      existing.visits.push(visit)
    } else {
      map.set(visit.account.id, { account: visit.account, visits: [visit] })
    }
  }
  return [...map.values()].sort((a, b) => a.account.name.localeCompare(b.account.name))
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
