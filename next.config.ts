import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

// Lets next/image serve `site-media` (task 9.2) — the public storage bucket
// for owner-uploaded marketing images. Derived rather than hardcoded so it
// tracks whichever Supabase project is linked. Guarded: an environment
// without NEXT_PUBLIC_SUPABASE_URL set (e.g. a fresh clone before
// .env.local exists) just gets no remote patterns instead of a crash.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined

const nextConfig: NextConfig = {
  // No webpack config — Turbopack is the default bundler (next dev --turbopack)
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Task 9.6: submitJobApplication carries an optional resume file
    // (capped at 4 MB — lib/utils/resumes.ts) through the Server Action as
    // FormData. Default limit is 1MB; 6mb gives headroom over the 4MB file
    // cap for multipart encoding overhead. Global setting — every Server
    // Action gets the higher ceiling, which is strictly more permissive and
    // fine, since nothing else in the app needs a lower one.
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
   * The crew PWA and the field management routes merged into /app/* (REDESIGN.md
   * R1). These are load-bearing, not migration scaffolding: an already-installed
   * PWA keeps its old `start_url` until someone reinstalls it, and phones have
   * these paths bookmarked.
   *
   * Query strings ride along automatically — `?week=`, `?visit=`, and
   * `?routeGroup=` all appear in real deep links.
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
      { source: '/management/dashboard', destination: '/app/dashboard', permanent: true },
      { source: '/management/accounts', destination: '/app/accounts', permanent: true },
      { source: '/management/accounts/:id', destination: '/app/accounts/:id', permanent: true },
    ]
  },
}

export default withSerwist(nextConfig)
