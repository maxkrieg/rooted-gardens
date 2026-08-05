import { createClient } from '@/lib/supabase/server'
import { collectionItemDataSchema, siteCollectionSchema } from '@/lib/validators/site-content'
import type { PageContent, SiteCollection, SiteCollectionItem, SitePage, SiteSlot } from '@/types/app'
import { CONTENT_DEFAULTS } from './defaults'

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
      slots[key] = { page: layerPage, key, kind: def.kind, value: def.value }
    }
    for (const row of rows) {
      if (row.page !== layerPage || row.value === null || row.value === undefined) continue
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
