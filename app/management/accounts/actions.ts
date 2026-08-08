'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import { syncCustomer, type SyncCustomerResult } from '@/lib/quickbooks/sync'
import { buildAccountPayload } from '@/lib/utils/accounts'
import { toUserMessage } from '@/lib/errors'

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
  const { error } = await supabase.from('accounts').insert(buildAccountPayload(parsed.data))

  if (error) {
    return { error: toUserMessage(error, 'Could not create the account.', '[createAccount]') }
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
    .update(buildAccountPayload(parsed.data))
    .eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not save the account.', '[updateAccount]') }
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
