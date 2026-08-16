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
 * Archive (soft-delete) an account and every property under it.
 *
 * Not a real DELETE: visits, invoices, photos and leads.converted_account_id all FK
 * back here with NO ACTION, so the rows have to survive for billing history to keep
 * rendering. The app filters is_archived out of every live list, picker and schedule
 * instead. Owner-only, enforced by the enforce_owner_only_archive trigger.
 *
 * supabase-js has no transactions, so this is two statements, and the order matters:
 * properties first, then the account. If the second statement fails, the account is
 * still visible in the list so the owner can retry, and re-archiving already-archived
 * properties is idempotent. The reverse order would hide the account everywhere while
 * leaving its properties live on the Routes page, with no UI left to retry from.
 */
export async function archiveAccount(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Drop route-group assignments first. property_route_groups is a pure join table
  // with no historical value (it already CASCADEs on property delete), and leaving
  // rows behind would under-count the "unrouted properties" nav badge, which is
  // computed as (properties − property_route_groups).
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

  revalidatePath('/management/accounts')
  revalidatePath(`/management/accounts/${id}`)
  // Archived properties drop off the route board and the schedule grid.
  revalidatePath('/management/routes')
  revalidatePath('/management/schedule')
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
