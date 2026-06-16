'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { propertyFormSchema, type PropertyFormValues } from '@/lib/validators/property'
import { serviceZoneFormSchema, type ServiceZoneFormValues } from '@/lib/validators/serviceZone'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateAccount(accountId: string) {
  revalidatePath(`/management/accounts/${accountId}`)
}

// ─── Properties ───────────────────────────────────────────────────────────────

/**
 * Create a property for the given account.
 *
 * For non-contract accounts (per_visit / as_needed), automatically creates a
 * default "Full Property" zone (weekly) so the crew can start scheduling
 * immediately without extra setup.
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

  // Insert the property
  const { data: property, error: propError } = await supabase
    .from('properties')
    .insert({
      account_id: accountId,
      address: parsed.data.address,
      parking_notes: parsed.data.parking_notes?.trim() || null,
      access_notes: parsed.data.access_notes?.trim() || null,
      crew_notes: parsed.data.crew_notes?.trim() || null,
    })
    .select('id')
    .single()

  if (propError || !property) {
    console.error('[createProperty]', propError)
    return { error: propError?.message ?? 'Failed to create property' }
  }

  // Auto-create a default zone for simple (non-contract) accounts
  const { data: account } = await supabase
    .from('accounts')
    .select('billing_type')
    .eq('id', accountId)
    .single()

  if (account && account.billing_type !== 'contract') {
    await supabase.from('service_zones').insert({
      property_id: property.id,
      account_id: accountId,
      name: 'Full Property',
      frequency: 'weekly',
      sort_order: 0,
      active: true,
    })
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Update an existing property's address and notes.
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

// ─── Service zones ────────────────────────────────────────────────────────────

/**
 * Add a new service zone to a property.
 * sort_order is set to (max existing sibling sort_order) + 1 so the new zone
 * is appended to the end of the crew visit sequence.
 */
export async function createServiceZone(
  propertyId: string,
  accountId: string,
  values: ServiceZoneFormValues,
): Promise<{ error?: string }> {
  const parsed = serviceZoneFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()

  // Determine next sort_order
  const { data: siblings } = await supabase
    .from('service_zones')
    .select('sort_order')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = siblings && siblings.length > 0 ? siblings[0].sort_order + 1 : 0

  const { error } = await supabase.from('service_zones').insert({
    property_id: propertyId,
    account_id: accountId,
    name: parsed.data.name,
    frequency: parsed.data.frequency,
    notes: parsed.data.notes?.trim() || null,
    sort_order: nextSortOrder,
    active: true,
  })

  if (error) {
    console.error('[createServiceZone]', error)
    return { error: error.message }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Update a zone's name, frequency, and notes.
 */
export async function updateServiceZone(
  id: string,
  accountId: string,
  values: ServiceZoneFormValues,
): Promise<{ error?: string }> {
  const parsed = serviceZoneFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('service_zones')
    .update({
      name: parsed.data.name,
      frequency: parsed.data.frequency,
      notes: parsed.data.notes?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('[updateServiceZone]', error)
    return { error: error.message }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Soft-delete (or restore) a zone by toggling its active flag.
 */
export async function setZoneActive(
  id: string,
  accountId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('service_zones')
    .update({ active })
    .eq('id', id)

  if (error) {
    console.error('[setZoneActive]', error)
    return { error: error.message }
  }

  revalidateAccount(accountId)
  return {}
}

/**
 * Move a zone up or down within its property by swapping sort_order with its neighbor.
 * Authoritative server-side swap — no optimistic updates needed on the client.
 */
export async function moveZone(
  id: string,
  accountId: string,
  direction: 'up' | 'down',
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Fetch this zone to get its property_id and current sort_order
  const { data: zone, error: zoneError } = await supabase
    .from('service_zones')
    .select('id, property_id, sort_order')
    .eq('id', id)
    .single()

  if (zoneError || !zone) {
    return { error: zoneError?.message ?? 'Zone not found' }
  }

  // Fetch all sibling zones in order
  const { data: siblings, error: siblingsError } = await supabase
    .from('service_zones')
    .select('id, sort_order')
    .eq('property_id', zone.property_id)
    .order('sort_order', { ascending: true })

  if (siblingsError || !siblings) {
    return { error: siblingsError?.message ?? 'Could not load zones' }
  }

  const idx = siblings.findIndex((z) => z.id === id)
  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1

  if (neighborIdx < 0 || neighborIdx >= siblings.length) {
    return {} // Already at the boundary — no-op
  }

  const neighbor = siblings[neighborIdx]
  const currentSortOrder = zone.sort_order
  const neighborSortOrder = neighbor.sort_order

  // Swap sort_order values
  const { error: e1 } = await supabase
    .from('service_zones')
    .update({ sort_order: neighborSortOrder })
    .eq('id', id)

  if (e1) {
    console.error('[moveZone]', e1)
    return { error: e1.message }
  }

  const { error: e2 } = await supabase
    .from('service_zones')
    .update({ sort_order: currentSortOrder })
    .eq('id', neighbor.id)

  if (e2) {
    console.error('[moveZone neighbor]', e2)
    return { error: e2.message }
  }

  revalidateAccount(accountId)
  return {}
}
