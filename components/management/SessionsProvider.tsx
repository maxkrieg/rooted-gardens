'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { visitVersion, type VisitOverlay } from '@/lib/utils/visits'

/**
 * Live overlay for the visits on screen.
 *
 * Two sources write to one map:
 *   1. Realtime `visits` UPDATE events — covers changes made anywhere, including
 *      crew completing a stop in the field on another device.
 *   2. The management drawer, which pushes the row it just wrote (see
 *      VisitDetailSheet). Realtime is best-effort by design; this half makes the
 *      repaint deterministic without a network round-trip.
 *
 * Consumers merge with mergeVisitOverlay(), which is version-guarded on
 * updated_at so server data reclaims the cell once it catches up. Still an
 * overlay, never the source of truth.
 *
 * (Named SessionsProvider from when it only tracked start/stop sessions — the
 * schedule page mounts it by that name.)
 */
const VisitOverlaysContext = createContext<Map<string, VisitOverlay>>(new Map())
const ApplyVisitOverlayContext = createContext<(visit: VisitOverlay) => void>(() => {})

export function useVisitOverlays(): Map<string, VisitOverlay> {
  return useContext(VisitOverlaysContext)
}

/** Push a locally-known update into the overlay (management drawer writes). */
export function useApplyVisitOverlay(): (visit: VisitOverlay) => void {
  return useContext(ApplyVisitOverlayContext)
}

interface SessionsProviderProps {
  visitIds: string[]
  children: React.ReactNode
}

export function SessionsProvider({ visitIds, children }: SessionsProviderProps) {
  const [overlays, setOverlays] = useState<Map<string, VisitOverlay>>(new Map())

  const applyOverlay = useCallback((visit: VisitOverlay) => {
    const incoming = visitVersion(visit)
    // No usable version marker — storing it would make every later comparison
    // undecidable, and returning a fresh Map on each call is what turns a
    // caller's effect into an infinite render loop.
    if (incoming === null) return

    setOverlays((prev) => {
      const existing = prev.get(visit.id)
      // Out-of-order arrivals are real: a Realtime event and the drawer's own
      // push describe the same write, and either can land first. Returning
      // `prev` unchanged is load-bearing — a new Map identity here re-renders
      // every consumer of this context.
      const current = existing ? visitVersion(existing) : null
      if (current !== null && current >= incoming) return prev
      return new Map(prev).set(visit.id, visit)
    })
  }, [])

  // Join to a stable string so the effect dep is a primitive, not an array reference.
  const visitIdsKey = visitIds.join(',')

  useEffect(() => {
    if (!visitIdsKey) return

    const supabase = createClient()
    const ids = new Set(visitIdsKey.split(','))

    const channel = supabase
      .channel('management_visits_overlay')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits' },
        (payload) => {
          // payload.new is the whole row under the default replica identity, so
          // status/crew_instruction/timing all ride along for free.
          const visit = payload.new as VisitOverlay
          if (!ids.has(visit.id)) return
          applyOverlay(visit)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitIdsKey, applyOverlay])

  return (
    <ApplyVisitOverlayContext.Provider value={applyOverlay}>
      <VisitOverlaysContext.Provider value={overlays}>{children}</VisitOverlaysContext.Provider>
    </ApplyVisitOverlayContext.Provider>
  )
}
