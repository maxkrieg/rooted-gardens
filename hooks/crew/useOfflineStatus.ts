'use client'

import { useCallback, useEffect, useState } from 'react'
import { getQueueCounts, flushMutationQueue, subscribeToQueue } from '@/lib/offline/mutation-queue'

/**
 * Connectivity + offline-queue state for the crew shell. `failedCount` is what
 * turns a silently stuck queue into something the crew member can act on.
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
        // IDB can be unavailable (private mode, storage pressure). Don't break
        // the shell, but don't swallow it — this is the only stuck-queue signal.
        console.error('[useOfflineStatus] queue counts', err)
      })
  }, [])

  useEffect(() => {
    // Correct from navigator on mount (SSR started at true), deferred to a
    // microtask so it isn't a synchronous setState in an effect.
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

    // The queue changes without any window event — enqueue, flush, park, retry.
    const unsubscribe = subscribeToQueue(refreshCount)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshCount])

  return { isOnline, pendingCount, failedCount, refreshCount }
}
