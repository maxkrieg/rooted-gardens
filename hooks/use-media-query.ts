'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. `useSyncExternalStore` rather than
 * useEffect+setState: the media query *is* an external store, and reading it
 * this way keeps the first client render consistent instead of flashing a
 * default and then correcting it. The server snapshot is always `false`, so
 * SSR renders the wide / full-motion / not-installed variant.
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

/**
 * True when the OS asks for reduced motion. Recharts animates bars in by
 * default; every chart gates `isAnimationActive` on this.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** True below Tailwind's `sm` breakpoint — drives compact axis labels. */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

/**
 * True when the app is running as an installed PWA rather than a browser tab.
 * `display-mode: standalone` covers Android/desktop; `navigator.standalone` is
 * the iOS Safari equivalent, which predates the media query and still doesn't
 * match it.
 */
export function useIsStandalone(): boolean {
  const displayMode = useMediaQuery('(display-mode: standalone)')
  return (
    displayMode ||
    (typeof navigator !== 'undefined' &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}
