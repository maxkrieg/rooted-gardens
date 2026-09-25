import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The whole app behind auth, plus auth/API surfaces — nothing there is
      // marketing content, and it's all behind proxy.ts anyway.
      disallow: ['/app/', '/management/', '/api/', '/login', '/auth/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
