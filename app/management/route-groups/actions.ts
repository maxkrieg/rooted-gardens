'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { routeGroupFormSchema, type RouteGroupFormValues } from '@/lib/validators/routeGroup'

function revalidate() {
  revalidatePath('/management/route-groups')
}

// ─── Route group CRUD ────────────────────────────────────────────────────────

export async function createRouteGroup(
  values: RouteGroupFormValues,
): Promise<{ error?: string }> {
  const parsed = routeGroupFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()

  // Append to end by using max existing sort_order + 1
  const { data: maxRow } = await supabase
    .from('route_groups')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = maxRow ? maxRow.sort_order + 1 : 0

  const { error } = await supabase.from('route_groups').insert({
    name: parsed.data.name,
    sort_order: nextSortOrder,
  })

  if (error) {
    console.error('[createRouteGroup]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

export async function updateRouteGroup(
  id: string,
  values: RouteGroupFormValues,
): Promise<{ error?: string }> {
  const parsed = routeGroupFormSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const supabase = await createClient()
  // Only update name — sort_order is managed by moveRouteGroup
  const { error } = await supabase
    .from('route_groups')
    .update({ name: parsed.data.name })
    .eq('id', id)

  if (error) {
    console.error('[updateRouteGroup]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

/**
 * Move a route group up or down by swapping sort_order with its neighbor.
 * Same pattern as moveZone in property-actions.ts.
 */
export async function moveRouteGroup(
  id: string,
  direction: 'up' | 'down',
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: groups, error: fetchError } = await supabase
    .from('route_groups')
    .select('id, sort_order')
    .order('sort_order', { ascending: true })

  if (fetchError || !groups) {
    return { error: fetchError?.message ?? 'Could not load route groups' }
  }

  const idx = groups.findIndex((g) => g.id === id)
  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1

  if (idx === -1 || neighborIdx < 0 || neighborIdx >= groups.length) {
    return {} // Already at boundary — no-op
  }

  const current = groups[idx]
  const neighbor = groups[neighborIdx]

  const { error: e1 } = await supabase
    .from('route_groups')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', current.id)

  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('route_groups')
    .update({ sort_order: current.sort_order })
    .eq('id', neighbor.id)

  if (e2) return { error: e2.message }

  revalidate()
  return {}
}

/**
 * Delete a route group.
 * Assignments in property_route_groups cascade via FK ON DELETE CASCADE.
 */
export async function deleteRouteGroup(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('route_groups').delete().eq('id', id)

  if (error) {
    console.error('[deleteRouteGroup]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

// ─── Property assignments ────────────────────────────────────────────────────

/**
 * Assign a property to a route group.
 * A property belongs to at most one route group (property_route_groups_property_idx).
 * The Assign Properties sheet already disables assignment for properties in
 * another group, so this pre-check is defense-in-depth for races (stale tab,
 * concurrent edit) — it returns a clear error instead of a raw Postgres
 * unique-violation, and onConflict targets the new unique index (not the old
 * composite PK) so a same-property upsert never throws.
 */
export async function assignProperty(
  propertyId: string,
  routeGroupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('property_route_groups')
    .select('route_group_id')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (existing && existing.route_group_id !== routeGroupId) {
    return { error: 'This property is already assigned to another route group.' }
  }

  const { error } = await supabase
    .from('property_route_groups')
    .upsert(
      { property_id: propertyId, route_group_id: routeGroupId, sort_order: 0 },
      { onConflict: 'property_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[assignProperty]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

/**
 * Assign multiple properties to a route group in one call — used by the
 * account-level bulk toggle in the Assign Properties sheet. Same
 * defense-in-depth pre-check as assignProperty, batched.
 */
export async function assignProperties(
  propertyIds: string[],
  routeGroupId: string,
): Promise<{ error?: string }> {
  if (propertyIds.length === 0) return {}

  const supabase = await createClient()

  const { data: existingRows } = await supabase
    .from('property_route_groups')
    .select('property_id, route_group_id')
    .in('property_id', propertyIds)

  const blocked = (existingRows ?? []).filter((r) => r.route_group_id !== routeGroupId)
  if (blocked.length > 0) {
    return {
      error: `${blocked.length} propert${blocked.length === 1 ? 'y is' : 'ies are'} already assigned to another route group.`,
    }
  }

  const { error } = await supabase
    .from('property_route_groups')
    .upsert(
      propertyIds.map((id) => ({ property_id: id, route_group_id: routeGroupId, sort_order: 0 })),
      { onConflict: 'property_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[assignProperties]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

/**
 * Remove a property from a route group.
 */
export async function unassignProperty(
  propertyId: string,
  routeGroupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('property_route_groups')
    .delete()
    .eq('property_id', propertyId)
    .eq('route_group_id', routeGroupId)

  if (error) {
    console.error('[unassignProperty]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}

/**
 * Remove multiple properties from a route group in one call — the unassign
 * counterpart to assignProperties for the account-level bulk toggle.
 */
export async function unassignProperties(
  propertyIds: string[],
  routeGroupId: string,
): Promise<{ error?: string }> {
  if (propertyIds.length === 0) return {}

  const supabase = await createClient()
  const { error } = await supabase
    .from('property_route_groups')
    .delete()
    .in('property_id', propertyIds)
    .eq('route_group_id', routeGroupId)

  if (error) {
    console.error('[unassignProperties]', error)
    return { error: error.message }
  }

  revalidate()
  return {}
}
