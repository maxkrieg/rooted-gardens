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
