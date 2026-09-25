'use client'

import { useEffect } from 'react'

/** Where Serwist serves the compiled worker (see app/serwist/[path]/route.ts). */
const SW_URL = '/serwist/sw.js'

// Off in dev unless NEXT_PUBLIC_ENABLE_SW=1: changing dev chunks made the worker refetch
// endlessly, feeding a dev-server livelock. Production always registers.
const SW_ENABLED =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (!SW_ENABLED) {
      // Unregister any worker left from an earlier session; it would keep controlling '/'.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister())
      })
      return
    }

    const register = async () => {
      try {
        // Retire the old placeholder /sw.js still installed on crew phones. A failed update fetch
        // leaves a registration in place, so unregister it explicitly.
        const existing = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          existing
            .filter((r) => {
              const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? ''
              return url.endsWith('/sw.js') && !url.endsWith(SW_URL)
            })
            .map((r) => r.unregister()),
        )

        await navigator.serviceWorker.register(SW_URL, { scope: '/' })
      } catch {
        // Registration failed — the app still works, just without offline
        // support. The crew mutation queue is independent of the worker.
      }
    }

    void register()
  }, [])

  return null
}
