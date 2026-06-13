import type { NextConfig } from 'next'
import { withSerwist } from '@serwist/turbopack'

const nextConfig: NextConfig = {
  // No webpack config — Turbopack is the default bundler (next dev --turbopack)
}

export default withSerwist(nextConfig)
