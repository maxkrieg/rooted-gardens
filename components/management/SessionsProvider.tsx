'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type VisitTiming = { started_at: string | null; ended_at: string | null }

const VisitTimingsContext = createContext<Map<string, VisitTiming>>(new Map())

export function useVisitTimings(): Map<string, VisitTiming> {
  return useContext(VisitTimingsContext)
}

interface SessionsProviderProps {
  visitIds: string[]
  children: React.ReactNode
}

export function SessionsProvider({ visitIds, children }: SessionsProviderProps) {
  const [timings, setTimings] = useState<Map<string, VisitTiming>>(new Map())

  // Join to a stable string so the effect dep is a primitive, not an array reference.
  const visitIdsKey = visitIds.join(',')

  useEffect(() => {
    if (!visitIdsKey) return

    const supabase = createClient()
    const ids = new Set(visitIdsKey.split(','))

    const channel = supabase
      .channel('management_visits_timing')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits' },
        (payload) => {
          const { id, started_at, ended_at } = payload.new as {
            id: string
            started_at: string | null
            ended_at: string | null
          }
          if (!ids.has(id)) return
          setTimings((prev) => {
            const next = new Map(prev)
            next.set(id, { started_at, ended_at })
            return next
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitIdsKey])

  return (
    <VisitTimingsContext.Provider value={timings}>{children}</VisitTimingsContext.Provider>
  )
}
