import { createClient } from '@/lib/supabase/server'
import { collectionItemDataSchema, siteCollectionSchema } from '@/lib/validators/site-content'
import type { PageContent, SiteCollection, SiteCollectionItem, SitePage, SiteSlot } from '@/types/app'
import { CONTENT_DEFAULTS } from './defaults'

/** Minimal escaper for the richtext default-fallback case below — the input
 *  is always a developer-authored string from defaults.ts, never user input,
 *  but this keeps the invariant "SiteSlot.value is always safe HTML for a
 *  richtext slot" true even for that path, with no exceptions to remember. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Server-only read layer for the public marketing site's DB-backed content
 * (task 9.2). Every public page calls `getPageContent` for its slots and
 * `getCollection` for any list it renders (FAQ / jobs / team) — never the
 * Supabase client directly, so the default-fallback and Zod validation stay
 * in one place.
 */

/**
 * All slots for a page, merged over `CONTENT_DEFAULTS` so a missing or
 * not-yet-edited row still renders real copy instead of a blank page.
 * `global` slots (footer contacts, socials) are always included alongside
 * the page's own slots — one query, `.in('page', ['global', page])`.
 */
export async function getPageContent(page: SitePage): Promise<PageContent> {
  const layers: SitePage[] = page === 'global' ? ['global'] : ['global', page]

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_content')
    .select('page, key, kind, value')
    .in('page', layers)

  if (error) {
    // Content defaults still render below — a read failure degrades to
    // "shows the fallback copy," never a broken page.
    console.error('[getPageContent]', page, error)
  }

  const rows = data ?? []
  const slots: Record<string, SiteSlot> = {}

  // Apply defaults first, then DB rows on top, layer by layer (global, then
  // the specific page) — so a page-level edit can override a global default
  // and neither layer can leave the other half-populated.
  for (const layerPage of layers) {
    for (const [key, def] of Object.entries(CONTENT_DEFAULTS[layerPage] ?? {})) {
      // A still-default richtext slot has no DB row yet, so no Tiptap `doc`
      // to resume editing from — the editor synthesizes a one-paragraph doc
      // from this plain string itself. `value` still has to be safe,
      // directly-renderable HTML, hence the escape-and-wrap.
      slots[key] =
        def.kind === 'richtext'
          ? { page: layerPage, key, kind: def.kind, value: `<p>${escapeHtml(def.value)}</p>` }
          : { page: layerPage, key, kind: def.kind, value: def.value }
    }
    for (const row of rows) {
      if (row.page !== layerPage || row.value === null || row.value === undefined) continue

      if (row.kind === 'richtext') {
        // task 9.2.5: a richtext row's jsonb value is `{ doc, html }` — `doc`
        // is the Tiptap JSON the editor resumes from, `html` (rendered once,
        // server-side, at save time — see app/(public)/actions.ts) is what
        // every page read actually uses. Never re-render `doc` on read: that
        // would mean pulling @tiptap/html + happy-dom into the hot read path.
        const richValue = row.value as { doc?: unknown; html?: string }
        if (typeof richValue?.html !== 'string') continue
        slots[row.key] = { page: layerPage, key: row.key, kind: 'richtext', value: richValue.html, doc: richValue.doc }
        continue
      }

      slots[row.key] = {
        page: layerPage,
        key: row.key,
        kind: row.kind as SiteSlot['kind'],
        value: String(row.value),
      }
    }
  }

  return { page, slots }
}

/** Convenience accessor: `getSlot(content, 'hero_heading')`. Never throws —
 *  an unknown key (e.g. a typo) just renders empty rather than crashing a
 *  marketing page for a copy mistake. */
export function getSlot(content: PageContent, key: string): string {
  return content.slots[key]?.value ?? ''
}

/**
 * Published items in an owner-managed collection (FAQ / jobs / team),
 * ordered for display. Each row is Zod-validated against its collection's
 * shape; a malformed row (e.g. hand-edited via SQL) is logged and skipped
 * rather than breaking the whole list.
 */
export async function getCollection<T>(collection: SiteCollection): Promise<SiteCollectionItem<T>[]> {
  siteCollectionSchema.parse(collection)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_collection_items')
    .select('id, sort_order, published, data')
    .eq('collection', collection)
    .eq('published', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getCollection]', collection, error)
    return []
  }

  const schema = collectionItemDataSchema(collection)
  const items: SiteCollectionItem<T>[] = []

  for (const row of data ?? []) {
    const parsed = schema.safeParse(row.data)
    if (!parsed.success) {
      console.error('[getCollection] invalid item', collection, row.id, parsed.error.message)
      continue
    }
    items.push({
      id: row.id,
      sortOrder: row.sort_order,
      published: row.published,
      data: parsed.data as T,
    })
  }

  return items
}
