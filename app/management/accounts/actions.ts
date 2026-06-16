'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'

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
  // Server-side re-validation
  const parsed = accountFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const data = parsed.data

  // Null out billing fields irrelevant to the chosen type
  const payload = {
    name: data.name,
    contact_name: data.contact_name?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    billing_type: data.billing_type,
    status: data.status,
    notes: data.notes?.trim() || null,
    // per_visit
    price_per_visit: data.billing_type === 'per_visit' ? (data.price_per_visit ?? null) : null,
    // contract
    contract_rate: data.billing_type === 'contract' ? (data.contract_rate ?? null) : null,
    contract_period: data.billing_type === 'contract' ? (data.contract_period ?? null) : null,
  }

  const supabase = await createClient()
  const { error } = await supabase.from('accounts').insert(payload)

  if (error) {
    console.error('[createAccount]', error)
    return { error: error.message }
  }

  revalidatePath('/management/accounts')
  return {}
}
