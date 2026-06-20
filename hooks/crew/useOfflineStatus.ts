'use client'

import { useEffect, useState } from 'react'
import { getPendingCount, flushMutationQueue } from '@/lib/crew/mutation-queue'

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)

  function refreshCount() {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => {})
  }

  useEffect(() => {
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
