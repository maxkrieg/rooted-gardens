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
 * Drop the persisted cache. Call on sign-out: `current-employee` is persisted,
 * so without this the next person to sign in on the same phone rehydrates the
 * previous person's employee row — and their role with it.
 *
 * Only touches the `rq-cache` store. The `mutations` store in the same database
 * holds unsynced field writes and must survive a sign-out.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  await persister.removeClient()
}

/**
 * Bump whenever a persisted query's *shape* changes, not just its data — a
 * restored entry written by an older bundle is otherwise indistinguishable from
 * a fresh one. `stop-detail` gaining `visit.updated_at` is the case in hand:
 * entries missing it made version comparison undecidable downstream.
 */
const CACHE_BUSTER = 'management-schedule-client'

/**
 * Allowlist, not a denylist: persistence is otherwise all-or-nothing, so any new
 * query would silently land in IndexedDB on a personal phone. Only what's needed
 * in the field belongs here — billing, team, and leads deliberately don't.
 */
const PERSISTED_QUERY_KEYS = new Set([
  'schedule-reference',
  'schedule-visits',
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
