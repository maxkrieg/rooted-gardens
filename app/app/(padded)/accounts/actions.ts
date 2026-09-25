'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import { syncCustomer, type SyncCustomerResult } from '@/lib/quickbooks/sync'
import { buildAccountPayload } from '@/lib/utils/accounts'
import { toUserMessage } from '@/lib/errors'

/** Create an account, nulling billing fields that don't apply to its billing_type. */
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

  revalidatePath('/app/accounts')
  return {}
}

/** Update an account; same conventions as createAccount. */
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

  revalidatePath('/app/accounts')
  revalidatePath(`/app/accounts/${id}`)
  return {}
}

/**
 * Archive (soft delete) an account and its properties; see "Archiving" in CLAUDE.md. Properties
 * first: if the account update then fails, it's still visible to retry.
 */
export async function archiveAccount(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Drop route assignments too, or the unrouted badge (properties − assignments) under-counts.
  const { data: propertyRows, error: propertyIdsError } = await supabase
    .from('properties')
    .select('id')
    .eq('account_id', id)

  if (propertyIdsError) {
    return {
      error: toUserMessage(
        propertyIdsError,
        "Could not read the account's properties.",
        '[archiveAccount]',
      ),
    }
  }

  const propertyIds = (propertyRows ?? []).map((p) => p.id)
  if (propertyIds.length > 0) {
    const { error: assignmentsError } = await supabase
      .from('property_route_groups')
      .delete()
      .in('property_id', propertyIds)

    if (assignmentsError) {
      return {
        error: toUserMessage(
          assignmentsError,
          "Could not clear the account's route assignments.",
          '[archiveAccount]',
        ),
      }
    }
  }

  const { error: propertiesError } = await supabase
    .from('properties')
    .update({ is_archived: true })
    .eq('account_id', id)

  if (propertiesError) {
    return {
      error: toUserMessage(
        propertiesError,
        "Could not delete the account's properties.",
        '[archiveAccount]',
      ),
    }
  }

  const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not delete the account.', '[archiveAccount]') }
  }

  revalidatePath('/app/accounts')
  revalidatePath(`/app/accounts/${id}`)
  // Archived properties drop off the route board and the schedule grid.
  revalidatePath('/app/routes')
  revalidatePath('/app/schedule')
  return {}
}

/** Link or refresh the account's QuickBooks customer. */
export async function syncAccountWithQuickBooks(accountId: string): Promise<SyncCustomerResult> {
  const result = await syncCustomer(accountId)
  if (!result.error) {
    revalidatePath(`/app/accounts/${accountId}`)
  }
  return result
}
