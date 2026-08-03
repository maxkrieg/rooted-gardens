'use client'

import { useCallback, useEffect, useState } from 'react'
import { getQueueCounts, flushMutationQueue } from '@/lib/crew/mutation-queue'

/**
 * Connectivity + offline-queue state for the crew shell.
 *
 * `failedCount` (task 8.5) is what turns a silently stuck queue into something
 * the crew member can act on: mutations that exhausted their retries are parked
 * rather than retried forever, and the banner escalates instead of sitting on
 * "Syncing 1 change…" indefinitely.
 */
export function useOfflineStatus() {
  // Always start online/empty to match SSR; the effect corrects it on the client.
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const refreshCount = useCallback(() => {
    getQueueCounts()
      .then(({ pending, failed }) => {
        setPendingCount(pending)
        setFailedCount(failed)
      })
      .catch((err) => {
        // IndexedDB can be unavailable (private mode, storage pressure). Don't
        // break the shell over it, but don't swallow it silently either — this
        // hook is the only thing standing between a stuck queue and the user.
        console.error('[useOfflineStatus] queue counts', err)
      })
  }, [])

  useEffect(() => {
    // Correct the online state from navigator on mount (SSR started at true).
    // Deferred to a microtask so this isn't a synchronous setState in an effect,
    // which cascades an extra render.
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) setIsOnline(navigator.onLine)
    })
    refreshCount()

    function handleOnline() {
      setIsOnline(true)
      flushMutationQueue().then(refreshCount).catch(refreshCount)
    }

    function handleOffline() {
      setIsOnline(false)
      refreshCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshCount])

  return { isOnline, pendingCount, failedCount, refreshCount }
}
