'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { propertyFormSchema, type PropertyFormValues } from '@/lib/validators/property'
import { toUserMessage } from '@/lib/errors'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateAccount(accountId: string) {
  revalidatePath(`/app/accounts/${accountId}`)
}

// ─── Properties ───────────────────────────────────────────────────────────────

/**
 * Create a property for the given account.
 */
export async function createProperty(
  accountId: string,
  values: PropertyFormValues,
): Promise<{ error?: string }> {
  const parsed = propertyFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('properties').insert({
    account_id: accountId,
    address: parsed.data.address,
    frequency: parsed.data.frequency,
    parking_notes: parsed.data.parking_notes?.trim() || null,
    access_notes: parsed.data.access_notes?.trim() || null,
    crew_notes: parsed.data.crew_notes?.trim() || null,
  })

  if (error) {
    return { error: toUserMessage(error, 'Could not add the property.', '[createProperty]') }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Update an existing property's address, frequency, and notes.
 */
export async function updateProperty(
  id: string,
  accountId: string,
  values: PropertyFormValues,
): Promise<{ error?: string }> {
  const parsed = propertyFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('properties')
    .update({
      address: parsed.data.address,
      frequency: parsed.data.frequency,
      parking_notes: parsed.data.parking_notes?.trim() || null,
      access_notes: parsed.data.access_notes?.trim() || null,
      crew_notes: parsed.data.crew_notes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not save the property.', '[updateProperty]') }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Archive (soft-delete) a single property.
 *
 * Kept as a row rather than deleted because visits and photos FK back here with
 * NO ACTION — see archiveAccount in ./actions.ts for the full rationale. Owner-only,
 * enforced by the enforce_owner_only_archive trigger.
 */
export async function archiveProperty(
  id: string,
  accountId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Drop the route-group assignment first — see archiveAccount in ./actions.ts: the
  // join table carries no history, and a leftover row under-counts the "unrouted
  // properties" nav badge, which is (properties − property_route_groups).
  const { error: assignmentError } = await supabase
    .from('property_route_groups')
    .delete()
    .eq('property_id', id)

  if (assignmentError) {
    return {
      error: toUserMessage(
        assignmentError,
        "Could not clear the property's route assignment.",
        '[archiveProperty]',
      ),
    }
  }

  const { error } = await supabase.from('properties').update({ is_archived: true }).eq('id', id)

  if (error) {
    return { error: toUserMessage(error, 'Could not delete the property.', '[archiveProperty]') }
  }

  revalidateAccount(accountId)
  // An archived property leaves the route board and the schedule grid.
  revalidatePath('/app/routes')
  revalidatePath('/app/schedule')
  return {}
}
