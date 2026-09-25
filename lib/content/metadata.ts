import type { Metadata } from 'next'
import { getPageContent, getSlot } from './site'
import type { SitePage } from '@/types/app'

/** Shared generateMetadata for public pages. Empty SEO slots fall back to the root layout. */
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
