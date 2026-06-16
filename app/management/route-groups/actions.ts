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
  const { error } = await supabase.from('route_groups').insert({
    name: parsed.data.name,
    sort_order: parsed.data.sort_order ?? 0,
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
  const { error } = await supabase
    .from('route_groups')
    .update({
      name: parsed.data.name,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .eq('id', id)

  if (error) {
    console.error('[updateRouteGroup]', error)
    return { error: error.message }
  }

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
 * Idempotent — uses upsert with onConflict on the composite PK
 * so re-assigning an already-assigned property is a no-op.
 */
export async function assignProperty(
  propertyId: string,
  routeGroupId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('property_route_groups')
    .upsert(
      { property_id: propertyId, route_group_id: routeGroupId, sort_order: 0 },
      { onConflict: 'property_id,route_group_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[assignProperty]', error)
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
