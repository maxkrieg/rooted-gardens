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
}

export default withSerwist(nextConfig)
