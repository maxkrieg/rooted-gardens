import type { MetadataRoute } from 'next'
import { PUBLIC_ROUTES } from '@/lib/content/routes'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${APP_URL}${route}`,
    changeFrequency: 'monthly',
    priority: route === '/' ? 1 : 0.6,
  }))
}
