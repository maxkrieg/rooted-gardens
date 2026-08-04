'use client'

import { useEffect } from 'react'

/** Where Serwist serves the compiled worker (see app/serwist/[path]/route.ts). */
const SW_URL = '/serwist/sw.js'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        // Retire the hand-written placeholder that used to live at /sw.js.
        // Crew phones already have it installed at scope '/', and deleting the
        // file isn't enough: per spec a failed update fetch leaves an existing
        // registration in place, so it has to be unregistered explicitly or it
        // keeps serving its stale navigation fallback forever.
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
