import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'
import { withSentryConfig } from '@sentry/nextjs/config'

// next/image for the public `site-media` bucket, derived from the Supabase URL when set.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined

const nextConfig: NextConfig = {
  // No webpack config — Turbopack is the default bundler (next dev --turbopack)
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Resume uploads (up to 4MB) go through a Server Action; 6mb covers multipart overhead.
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/site-media/**',
          },
        ]
      : [],
  },
  /**
   * Redirects from the pre-/app/* URLs. Keep them: installed PWAs hold the old start_url and
   * phones have these bookmarked. Query strings carry over.
   */
  async redirects() {
    return [
      { source: '/crew/stop/:visitId', destination: '/app/stop/:visitId', permanent: true },
      { source: '/crew/schedule', destination: '/app/schedule', permanent: true },
      // History and Profile are gone — History was a read-only personal list, and
      // Profile's two real controls (sign-out, SMS opt-out) moved into `More`.
      { source: '/crew/history', destination: '/app/schedule', permanent: true },
      { source: '/crew/profile', destination: '/app/schedule', permanent: true },
      { source: '/crew', destination: '/app/schedule', permanent: true },

      { source: '/management/schedule', destination: '/app/schedule', permanent: true },
      { source: '/management/routes', destination: '/app/routes', permanent: true },
      // The dashboard is now the schedule's Today view.
      {
        source: '/management/dashboard',
        destination: '/app/schedule?view=today',
        permanent: true,
      },
      { source: '/app/dashboard', destination: '/app/schedule?view=today', permanent: false },
      { source: '/management/accounts', destination: '/app/accounts', permanent: true },
      { source: '/management/accounts/:id', destination: '/app/accounts/:id', permanent: true },
    ]
  },
}

export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // A fixed path (not `true`) so proxy.ts's matcher can exclude it; ad blockers on crew phones
  // drop requests to sentry.io. Must stay outside /app and /management, which the proxy gates.
  tunnelRoute: '/monitoring',
  sourcemaps: {
    // No token, no upload — and the SDK only deletes browser maps after an upload, so don't
    // generate them at all rather than serve them publicly.
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: true,
})
