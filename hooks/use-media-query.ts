'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a media query via useSyncExternalStore, so the first render doesn't flash a
 * default. The server snapshot is always `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** OS reduced-motion preference; charts gate `isAnimationActive` on it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** True below Tailwind's `sm` breakpoint — drives compact axis labels. */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

/** Running as an installed PWA. `navigator.standalone` covers iOS Safari. */
export function useIsStandalone(): boolean {
  const displayMode = useMediaQuery('(display-mode: standalone)')
  return (
    displayMode ||
    (typeof navigator !== 'undefined' &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}
