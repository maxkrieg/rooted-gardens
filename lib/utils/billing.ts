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
