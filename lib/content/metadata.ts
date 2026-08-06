import type { Metadata } from 'next'
import { getPageContent, getSlot } from './site'
import type { SitePage } from '@/types/app'

/**
 * Shared `generateMetadata` body for every public page (task 9.4 mechanical
 * refactor — this block was byte-identical across all seven pages before).
 * `seo_title`/`seo_description` are owner-editable `site_content` slots
 * (task 9.2); `openGraph` falls back to the root layout's defaults
 * (app/layout.tsx) whenever a slot is still empty, same as `title`/
 * `description` themselves already did via `undefined`.
 */
export async function pageMetadata(page: SitePage): Promise<Metadata> {
  const content = await getPageContent(page)
  const title = getSlot(content, 'seo_title') || undefined
  const description = getSlot(content, 'seo_description') || undefined

  return {
    title,
    description,
    openGraph: { title, description },
  }
}
