'use server'

import { revalidatePath } from 'next/cache'
// Explicit /server subpath, not the package root: the root's "node" export
// condition *should* resolve here automatically under Next's server bundling,
// but this file's only job is generating trusted HTML server-side, so there's
// no reason to depend on that resolution being right — see the "Key design
// decision" in the 9.2.5 plan for why this (and happy-dom) live ONLY here,
// never in a page or a client component.
import { generateHTML } from '@tiptap/html/server'
import type { JSONContent } from '@tiptap/core'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
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
  // Invalidates every page under the public layout in one call — correct for
  // a `global` slot (footer/contact info appears on all seven pages) without
  // needing a page→path lookup table. Currently a no-op safety net: 9.2 made
  // every public route render dynamically (no cache), so `router.refresh()`
  // client-side is what actually pulls fresh data — this is here so adding
  // `unstable_cache` later doesn't also require remembering to add this.
  revalidatePath('/(public)', 'layout')
}

/**
 * Resolve the acting employee and assert they're an owner.
 *
 * Same shape as `requireManagingEmployee` in
 * app/management/accounts/photo-actions.ts, restricted to `owner` only —
 * editing the public site is owner-only per the site_content /
 * site_collection_items RLS policies (migration 20260804140000). RLS is the
 * actual security boundary; this exists purely to return a better error
 * message than a raw RLS-denial would.
 */
async function requireOwner(): Promise<
  { employeeId: string; error?: undefined } | { employeeId?: undefined; error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!employee) return { error: 'No employee record for this login' }
  if (employee.role !== 'owner') return { error: 'Only owners can edit the public site' }

  return { employeeId: employee.id }
}

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
 * Updates a richtext slot from the editor's Tiptap JSON. Renders the HTML
 * once, here, server-side — never on a page read (see lib/content/site.ts
 * and the 9.2.5 plan's "Key design decision"). `getSchema`/`Node.fromJSON`
 * throws on a doc that doesn't match `RICHTEXT_EXTENSIONS`'s schema, which
 * the try/catch turns into a normal `{error}` return instead of a 500.
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
    // generateHTML builds the schema from RICHTEXT_EXTENSIONS and parses
    // `doc` against it (Node.fromJSON) internally — it throws on a doc that
    // doesn't match, which the catch below turns into a normal error return.
    // The cast is safe: richTextDocSchema already checked the top-level
    // shape, and generateHTML's own parse is the real structural validation.
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
      // `parsed.data.doc`'s content array is `unknown[]` (richTextDocSchema
      // only shape-checks the top level — see that schema's comment); the
      // cast is safe, `generateHTML` above already parsed it successfully
      // against the real Tiptap schema.
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

/** Creates (no `id`) or updates (`id`) a collection item's `data` only —
 *  `sort_order` is server-computed on insert (append at max+1, same as
 *  `createRouteGroup`) and otherwise untouched; reordering is
 *  `moveCollectionItem`, matching `updateRouteGroup`'s "only touches the
 *  edited field, never sort_order" split. */
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

/**
 * Move a collection item up or down by swapping `sort_order` with its
 * neighbor — verbatim port of `moveRouteGroup`
 * (app/management/route-groups/actions.ts), scoped by `collection`.
 */
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
