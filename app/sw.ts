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
 * Owners run management from the field on weak signal, so these sit ahead of
 * defaultCache: its NetworkFirst rules never time out (one bar hangs instead of
 * serving cache) and share one 32-entry LRU across the whole origin.
 */
const managementCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin && request.headers.get('RSC') === '1' && url.pathname.startsWith('/management'),
    handler: new NetworkFirst({
      cacheName: 'management-rsc',
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin && request.destination === 'document' && url.pathname.startsWith('/management'),
    handler: new NetworkFirst({
      cacheName: 'management-pages',
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
  runtimeCaching: [...managementCaching, ...defaultCache],
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
