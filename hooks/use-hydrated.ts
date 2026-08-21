'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * False during SSR *and* the hydration render, true afterwards.
 *
 * `useSyncExternalStore` rather than setState-in-an-effect: the server snapshot
 * is what React reuses while hydrating, so the two renders are guaranteed to
 * agree. Gate any subtree whose data only exists on the client — the schedule
 * reads React Query's IndexedDB cache, which the server can't see.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

function subscribeToOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Connectivity alone, for views that must degrade rather than show stale data.
 * useOfflineStatus also counts the queue in IndexedDB; this doesn't. Optimistic
 * on the server so SSR renders the connected variant.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeToOnline,
    () => navigator.onLine,
    () => true,
  )
}
