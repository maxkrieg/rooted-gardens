'use client'

import { useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { getDB } from '@/lib/crew/idb'
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
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {/* Inside the query provider so the fallback's retry can reach the cache. */}
      <ErrorBoundary>{children}</ErrorBoundary>
      <Toaster richColors position="top-right" />
    </PersistQueryClientProvider>
  )
}
