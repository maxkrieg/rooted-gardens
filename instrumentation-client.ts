import * as Sentry from '@sentry/nextjs'
import { sharedSentryOptions } from '@/lib/observability/sentry-options'

Sentry.init({
  ...sharedSentryOptions,
  // Crew hit errors where there's no signal. The offline transport holds events in IndexedDB
  // (its own database, not `rooted-crew`) and sends them once the phone is back online.
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
  ignoreErrors: [
    // Weak signal, not bugs. The offline queue retries these on its own.
    /Failed to fetch/i,
    /NetworkError when attempting to fetch/i,
    /Load failed/i,
    /The network connection was lost/i,
    // A deploy retired the chunk an old tab was holding; the next navigation picks up the new one.
    /ChunkLoadError/i,
    /Loading chunk [\w-]+ failed/i,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
