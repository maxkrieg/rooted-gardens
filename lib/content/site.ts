import { createClient } from '@/lib/supabase/server'
import { collectionItemDataSchema, siteCollectionSchema } from '@/lib/validators/site-content'
import type { PageContent, SiteCollection, SiteCollectionItem, SitePage, SiteSlot } from '@/types/app'
import { CONTENT_DEFAULTS } from './defaults'

/** Keeps richtext `value` always-safe HTML, even for developer-authored defaults. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Server-only read layer for public site content. Pages go through this, never Supabase directly. */

/** All slots for a page plus `global`, merged over CONTENT_DEFAULTS so nothing renders blank. */
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

  // Defaults first, then DB rows, global then page, so a page edit can override a global default.
  for (const layerPage of layers) {
    for (const [key, def] of Object.entries(CONTENT_DEFAULTS[layerPage] ?? {})) {
      // A default richtext slot has no `doc`; the editor builds one from this escaped string.
      slots[key] =
        def.kind === 'richtext'
          ? { page: layerPage, key, kind: def.kind, value: `<p>${escapeHtml(def.value)}</p>` }
          : { page: layerPage, key, kind: def.kind, value: def.value }
    }
    for (const row of rows) {
      if (row.page !== layerPage || row.value === null || row.value === undefined) continue

      if (row.kind === 'richtext') {
        // Richtext rows store `{ doc, html }`. Reads use the pre-rendered `html`; never render
        // `doc` here.
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

/** Unknown keys render empty rather than crash a marketing page. */
export function getSlot(content: PageContent, key: string): string {
  return content.slots[key]?.value ?? ''
}

/** Published collection items in display order. Rows failing Zod are logged and skipped. */
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
