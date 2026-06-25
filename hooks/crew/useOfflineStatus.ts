'use client'

import { useEffect, useState } from 'react'
import { getPendingCount, flushMutationQueue } from '@/lib/crew/mutation-queue'

export function useOfflineStatus() {
  // Always start true to match SSR; useEffect corrects it on the client.
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  function refreshCount() {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => {})
  }

  useEffect(() => {
    // Correct the online state from navigator on mount (SSR started as true)
    setIsOnline(navigator.onLine)
    // Seed the pending count from IDB on mount
    refreshCount()

    function handleOnline() {
      setIsOnline(true)
      flushMutationQueue().then(refreshCount)
    }

    function handleOffline() {
      setIsOnline(false)
      refreshCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, pendingCount, refreshCount }
}
