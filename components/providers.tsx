'use client'

import { useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { getDB } from '@/lib/offline/idb'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/states/ErrorBoundary'
import { isRetryableError } from '@/lib/errors'

// IDB-backed async storage adapter for the React Query cache persister.
// Crew routes rely on this to show last-fetched stops when offline.
const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const db = await getDB()
      const value = await db.get('rq-cache', key)
      return value ?? null
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const db = await getDB()
      await db.put('rq-cache', value, key)
    } catch {
      // Storage unavailable — degrade gracefully
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const db = await getDB()
      await db.delete('rq-cache', key)
    } catch {
      // Storage unavailable — ignore
    }
  },
}

const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'rq-v1',
})

/**
 * Drop the persisted query cache on sign-out, or the next user inherits the previous user's
 * employee row. Leaves the `mutations` store (unsynced writes) alone.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  await persister.removeClient()
}

/** Bump when a persisted query's shape changes, so older entries are discarded. */
const CACHE_BUSTER = 'property-cadence-2'

/**
 * Allowlist of persisted query keys; field data only (no billing, team, or leads). Values must
 * be JSON-safe: a Map rehydrates as {}.
 */
const PERSISTED_QUERY_KEYS = new Set([
  'schedule-reference',
  'schedule-visits',
  'schedule-week-notes',
  'accounts-list',
  'account-detail',
  'account-photos',
  'fleet-issues',
  'routes-data',
  'nav-lead-count',
  'nav-unrouted-count',
  'stop-detail',
  'current-employee',
  'active-employees',
  'active-vehicles',
  'property-photos',
  'property-visit-history',
  'property-last-visit',
  'onboarding-progress',
])

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            // Crew queries should show stale cached data when offline
            // rather than throwing a network error
            gcTime: 1000 * 60 * 60 * 24,
            // Retry transient failures, but give up at once on RLS denials and
            // expired sessions — retrying only delays the real error.
            retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
        },
      })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            typeof query.queryKey[0] === 'string' && PERSISTED_QUERY_KEYS.has(query.queryKey[0]),
        },
      }}
    >
      {/* Inside the query provider so the fallback's retry can reach the cache. */}
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster richColors position="top-right" />
    </PersistQueryClientProvider>
  )
}
