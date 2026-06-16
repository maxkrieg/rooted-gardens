import type { Account } from '@/types/app'

/**
 * Format the billing rate for display.
 * Works with any object that has the Account billing fields.
 */
export function formatAccountPrice(
  account: Pick<Account, 'billing_type' | 'price_per_visit' | 'contract_rate' | 'contract_period'>,
): string {
  if (account.billing_type === 'per_visit' && account.price_per_visit != null) {
    return `$${Number(account.price_per_visit).toFixed(2)} / visit`
  }
  if (account.billing_type === 'contract' && account.contract_rate != null) {
    const period = account.contract_period ?? 'period'
    return `$${Number(account.contract_rate).toFixed(2)} / ${period}`
  }
  return '—'
}
