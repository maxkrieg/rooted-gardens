import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { ExpirationPlugin, NetworkFirst, Serwist } from 'serwist'
// @serwist/turbopack, NOT @serwist/next — the latter is the webpack integration
// and pulling it in would break the Turbopack build (see CLAUDE.md).
import { defaultCache } from '@serwist/turbopack/worker'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/**
 * Owners and crew both work from the field on weak signal, so these sit ahead of
 * defaultCache: its NetworkFirst rules never time out (one bar hangs instead of
 * serving cache) and share one 32-entry LRU across the whole origin.
 *
 * Covers `/app` (the merged field surface) and `/management` (the desk routes,
 * which owners still reach from a phone). Cache names changed with the paths —
 * the old `management-*` caches only held URLs that no longer exist.
 */
const isAppPath = (pathname: string) =>
  pathname.startsWith('/app') || pathname.startsWith('/management')

const appCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin && request.headers.get('RSC') === '1' && isAppPath(url.pathname),
    handler: new NetworkFirst({
      cacheName: 'app-rsc',
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin && request.destination === 'document' && isAppPath(url.pathname),
    handler: new NetworkFirst({
      cacheName: 'app-pages',
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
    }),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Off deliberately: preload races the network on every navigation, the wrong
  // bias when the network is the unreliable part.
  navigationPreload: false,
  runtimeCaching: [...appCaching, ...defaultCache],
  fallbacks: {
    // Static file, not an app route — only public/** and .next/static/** are
    // precached, so an App Router page would not be available offline.
    entries: [
      {
        url: '/offline.html',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
})

serwist.addEventListeners()
