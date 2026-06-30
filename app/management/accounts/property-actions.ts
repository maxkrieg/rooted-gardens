'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { propertyFormSchema, type PropertyFormValues } from '@/lib/validators/property'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateAccount(accountId: string) {
  revalidatePath(`/management/accounts/${accountId}`)
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
    console.error('[createProperty]', error)
    return { error: error.message }
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
    console.error('[updateProperty]', error)
    return { error: error.message }
  }

  revalidateAccount(accountId)
  return {}
}
