'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import { syncCustomer, type SyncCustomerResult } from '@/lib/quickbooks/sync'

/** Shared helper — builds the DB insert/update payload from validated form values. */
function buildPayload(data: AccountFormValues) {
  return {
    name: data.name,
    contact_name: data.contact_name?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
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

/**
 * Create a new account.
 *
 * Re-validates on the server (never trust the client).
 * Uses the RLS-respecting server client — owner/lead INSERT policy (task 2.1) applies.
 * Nulls out billing fields that don't apply to the chosen billing_type so the DB
 * stays clean (e.g. per_visit accounts always have contract_rate = null).
 */
export async function createAccount(
  values: AccountFormValues,
): Promise<{ error?: string }> {
  const parsed = accountFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('accounts').insert(buildPayload(parsed.data))

  if (error) {
    console.error('[createAccount]', error)
    return { error: error.message }
  }

  revalidatePath('/management/accounts')
  return {}
}

/**
 * Update an existing account.
 *
 * Same validation + payload conventions as createAccount.
 * The RLS owner/lead UPDATE policy + the accountant column-guard trigger (task 2.1) apply.
 * Revalidates both the list page and the account's own detail page.
 */
export async function updateAccount(
  id: string,
  values: AccountFormValues,
): Promise<{ error?: string }> {
  const parsed = accountFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('accounts')
    .update(buildPayload(parsed.data))
    .eq('id', id)

  if (error) {
    console.error('[updateAccount]', error)
    return { error: error.message }
  }

  revalidatePath('/management/accounts')
  revalidatePath(`/management/accounts/${id}`)
  return {}
}

/**
 * Server Action wrapper for lib/quickbooks/sync.ts's syncCustomer — link (or
 * refresh/verify) the account's QuickBooks customer. Revalidates the account
 * detail page so the fresh qbo_customer_id renders after the sync.
 */
export async function syncAccountWithQuickBooks(accountId: string): Promise<SyncCustomerResult> {
  const result = await syncCustomer(accountId)
  if (!result.error) {
    revalidatePath(`/management/accounts/${accountId}`)
  }
  return result
}
