'use client'

import type { QueryClient } from '@tanstack/react-query'
import { clearPersistedQueryCache } from '@/components/providers'
import { getQueueCounts } from '@/lib/offline/mutation-queue'

/**
 * Refuse to switch identity while offline writes are waiting. Each queued write carries the
 * employee id it was made as, but syncs under whoever is signed in when it flushes, so a
 * leftover would land half as one person and half as the other.
 */
export async function queueBlocksSwitch(): Promise<string | null> {
  try {
    const { pending, failed } = await getQueueCounts()
    if (pending > 0) {
      return `${pending} offline ${pending === 1 ? 'change is' : 'changes are'} still syncing. Wait for ${pending === 1 ? 'it' : 'them'} to finish, then try again.`
    }
    if (failed > 0) {
      return `${failed} ${failed === 1 ? 'change' : 'changes'} didn't save. Retry or discard ${failed === 1 ? 'it' : 'them'} in "Changes that didn't save" first.`
    }
    return null
  } catch {
    // IDB unavailable means nothing can be queued either.
    return null
  }
}

/**
 * Same cleanup as sign-out, then a full load: the persisted cache belongs to the old identity,
 * and a reload is what reconnects Realtime and the offline flush under the new one.
 */
export async function finishIdentitySwitch(queryClient: QueryClient, home: string): Promise<void> {
  queryClient.clear()
  await clearPersistedQueryCache()
  window.location.assign(home)
}
