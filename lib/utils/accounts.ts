import type { Account } from '@/types/app'
import type { AccountFormValues } from '@/lib/validators/account'

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

/**
 * Builds the DB insert/update payload from validated account form values.
 * Shared by createAccount / updateAccount (app/management/accounts/actions.ts)
 * and convertLeadToAccount (app/management/leads/actions.ts, task 9.9) — moved
 * out of the actions file since every export there must be an async Server
 * Action, so a plain payload builder couldn't live there and be imported
 * elsewhere.
 */
export function buildAccountPayload(data: AccountFormValues) {
  return {
    name: data.name,
    contact_name: data.contact_name?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    billing_address_line1: data.billing_address_line1?.trim() || null,
    billing_address_line2: data.billing_address_line2?.trim() || null,
    billing_city: data.billing_city?.trim() || null,
    billing_state: data.billing_state?.trim() || null,
    billing_zip: data.billing_zip?.trim() || null,
    billing_type: data.billing_type,
    status: data.status,
    notes: data.notes?.trim() || null,
    qbo_customer_id: data.qbo_customer_id?.trim() || null,
    // Null out billing fields that don't apply to the chosen type
    price_per_visit: data.billing_type === 'per_visit' ? (data.price_per_visit ?? null) : null,
    contract_rate: data.billing_type === 'contract' ? (data.contract_rate ?? null) : null,
    contract_period: data.billing_type === 'contract' ? (data.contract_period ?? null) : null,
  }
}
