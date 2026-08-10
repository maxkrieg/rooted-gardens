'use client'

import { useEffect } from 'react'

/** Where Serwist serves the compiled worker (see app/serwist/[path]/route.ts). */
const SW_URL = '/serwist/sw.js'

// Dev-gated: dev chunk URLs change on every edit, and defaultCache's
// StaleWhileRevalidate strategies (see app/sw.ts) double-fetch every one of them
// forever once a worker is registered at scope '/' — that request pressure was
// found to be feeding a Turbopack dev-server livelock (900%+ CPU). Set
// NEXT_PUBLIC_ENABLE_SW=1 to exercise offline behavior locally; production
// always registers.
const SW_ENABLED =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (!SW_ENABLED) {
      // Unregister proactively — a worker installed in an earlier session (or
      // before this gate existed) keeps controlling the whole origin at scope
      // '/' even after this component stops calling register().
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister())
      })
      return
    }

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
