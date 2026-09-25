'use server'

import { revalidatePath } from 'next/cache'
// Explicit /server subpath: trusted HTML is generated only here, never in a page or client code.
import { generateHTML } from '@tiptap/html/server'
import type { JSONContent } from '@tiptap/core'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/server-role'
import { toUserMessage } from '@/lib/errors'
import { RICHTEXT_EXTENSIONS } from '@/lib/content/richtext-schema'
import {
  collectionItemDataSchema,
  deleteCollectionItemSchema,
  moveCollectionItemSchema,
  updateRichTextSlotSchema,
  updateSiteSlotSchema,
  upsertCollectionItemSchema,
  type DeleteCollectionItemValues,
  type MoveCollectionItemValues,
  type UpdateRichTextSlotValues,
  type UpdateSiteSlotValues,
  type UpsertCollectionItemValues,
} from '@/lib/validators/site-content'

function revalidate() {
  // Invalidates every public page (global slots appear on all). A safety net for future caching.
  revalidatePath('/(public)', 'layout')
}

const requireOwner = () => requireRole(['owner'], 'Only owners can edit the public site')

// ─── site_content slots ────────────────────────────────────────────────────────

/** Updates a text/email/phone/url/image slot. Richtext slots go through
 *  `updateRichTextSlot` instead — see lib/validators/site-content.ts. */
export async function updateSiteSlot(values: UpdateSiteSlotValues): Promise<{ error?: string }> {
  const parsed = updateSiteSlotSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid value' }
  }

  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('site_content').upsert(
    {
      page: parsed.data.page,
      key: parsed.data.key,
      kind: parsed.data.kind,
      value: parsed.data.value,
      updated_by: auth.employeeId,
    },
    { onConflict: 'page,key' },
  )

  if (error) {
    return { error: toUserMessage(error, 'Could not save that change.', '[updateSiteSlot]') }
  }

  revalidate()
  return {}
}

/**
 * Saves a richtext slot, rendering its HTML once here (never on read). A doc that doesn't match
 * the schema throws, returned as `{ error }`.
 */
export async function updateRichTextSlot(
  values: UpdateRichTextSlotValues,
): Promise<{ error?: string }> {
  const parsed = updateRichTextSlotSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid content' }
  }

  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  let html: string
  try {
    // generateHTML parses `doc` against the real schema and throws on mismatch, so the cast is
    // safe.
    html = generateHTML(parsed.data.doc as unknown as JSONContent, RICHTEXT_EXTENSIONS)
  } catch (err) {
    console.error('[updateRichTextSlot] invalid doc', err)
    return { error: 'Could not save — that formatting could not be read. Try again.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('site_content').upsert(
    {
      page: parsed.data.page,
      key: parsed.data.key,
      kind: 'richtext',
      // Safe: generateHTML above already parsed this doc.
      value: { doc: parsed.data.doc, html } as Database['public']['Tables']['site_content']['Row']['value'],
      updated_by: auth.employeeId,
    },
    { onConflict: 'page,key' },
  )

  if (error) {
    return { error: toUserMessage(error, 'Could not save that change.', '[updateRichTextSlot]') }
  }

  revalidate()
  return {}
}

// ─── site_collection_items ──────────────────────────────────────────────────────

/**
 * Creates (no `id`) or updates `data` only. sort_order is set on insert; reorder via
 * moveCollectionItem.
 */
export async function upsertCollectionItem(
  values: UpsertCollectionItemValues,
): Promise<{ error?: string; id?: string }> {
  const parsed = upsertCollectionItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid data' }
  }

  const itemSchema = collectionItemDataSchema(parsed.data.collection)
  const parsedData = itemSchema.safeParse(parsed.data.data)
  if (!parsedData.success) {
    return { error: parsedData.error.issues[0]?.message ?? 'Invalid data' }
  }

  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()

  if (parsed.data.id) {
    const { error } = await supabase
      .from('site_collection_items')
      .update({ data: parsedData.data })
      .eq('id', parsed.data.id)

    if (error) {
      return { error: toUserMessage(error, 'Could not save that entry.', '[upsertCollectionItem]') }
    }

    revalidate()
    return { id: parsed.data.id }
  }

  const { data: maxRow } = await supabase
    .from('site_collection_items')
    .select('sort_order')
    .eq('collection', parsed.data.collection)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = maxRow ? maxRow.sort_order + 1 : 0

  const { data: inserted, error } = await supabase
    .from('site_collection_items')
    .insert({
      collection: parsed.data.collection,
      data: parsedData.data,
      sort_order: nextSortOrder,
      published: true,
    })
    .select('id')
    .single()

  if (error) {
    return { error: toUserMessage(error, 'Could not add that entry.', '[upsertCollectionItem]') }
  }

  revalidate()
  return { id: inserted.id }
}

export async function deleteCollectionItem(
  values: DeleteCollectionItemValues,
): Promise<{ error?: string }> {
  const parsed = deleteCollectionItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_collection_items')
    .delete()
    .eq('id', parsed.data.id)
    .eq('collection', parsed.data.collection)

  if (error) {
    return { error: toUserMessage(error, 'Could not delete that entry.', '[deleteCollectionItem]') }
  }

  revalidate()
  return {}
}

/** Move a collection item up or down by swapping sort_order, like moveRouteGroup. */
export async function moveCollectionItem(
  values: MoveCollectionItemValues,
): Promise<{ error?: string }> {
  const parsed = moveCollectionItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()

  const { data: items, error: fetchError } = await supabase
    .from('site_collection_items')
    .select('id, sort_order')
    .eq('collection', parsed.data.collection)
    .order('sort_order', { ascending: true })

  if (fetchError || !items) {
    return { error: fetchError?.message ?? 'Could not load that list' }
  }

  const idx = items.findIndex((item) => item.id === parsed.data.id)
  const neighborIdx = parsed.data.direction === 'up' ? idx - 1 : idx + 1

  if (idx === -1 || neighborIdx < 0 || neighborIdx >= items.length) {
    return {} // Already at boundary — no-op
  }

  const current = items[idx]
  const neighbor = items[neighborIdx]

  const { error: e1 } = await supabase
    .from('site_collection_items')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', current.id)

  if (e1) return { error: toUserMessage(e1, 'Could not reorder that list.', '[moveCollectionItem]') }

  const { error: e2 } = await supabase
    .from('site_collection_items')
    .update({ sort_order: current.sort_order })
    .eq('id', neighbor.id)

  if (e2) return { error: toUserMessage(e2, 'Could not reorder that list.', '[moveCollectionItem]') }

  revalidate()
  return {}
}
