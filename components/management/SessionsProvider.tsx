'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { VisitSessionWithEmployee } from '@/types/app'

const SessionsContext = createContext<VisitSessionWithEmployee[]>([])

export function useSessions(): VisitSessionWithEmployee[] {
  return useContext(SessionsContext)
}

interface SessionsProviderProps {
  visitIds: string[]
  children: React.ReactNode
}

export function SessionsProvider({ visitIds, children }: SessionsProviderProps) {
  const [sessions, setSessions] = useState<VisitSessionWithEmployee[]>([])

  // Join to a stable string so the effect dep is a primitive, not an array reference.
  const visitIdsKey = visitIds.join(',')

  useEffect(() => {
    const supabase = createClient()

    // Fetch current sessions for the visible visits — called on mount and whenever
    // the visible visit set changes (week navigation).
    async function loadSessions() {
      if (!visitIdsKey) {
        setSessions([])
        return
      }
      const { data } = await supabase
        .from('visit_sessions')
        .select('*, employee:employees(*)')
        .in('visit_id', visitIdsKey.split(','))
      if (data) setSessions(data as unknown as VisitSessionWithEmployee[])
    }

    void loadSessions()

    const channel = supabase
      .channel('management_visit_sessions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visit_sessions' },
        async (payload) => {
          const { data } = await supabase
            .from('visit_sessions')
            .select('*, employee:employees(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setSessions((prev) => [...prev, data as unknown as VisitSessionWithEmployee])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visit_sessions' },
        (payload) => {
          setSessions((prev) =>
            prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } : s))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitIdsKey])

  return <SessionsContext.Provider value={sessions}>{children}</SessionsContext.Provider>
}
