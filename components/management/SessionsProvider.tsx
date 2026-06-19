'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { VisitSessionWithEmployee } from '@/types/app'

const SessionsContext = createContext<VisitSessionWithEmployee[]>([])

export function useSessions(): VisitSessionWithEmployee[] {
  return useContext(SessionsContext)
}

interface SessionsProviderProps {
  initialSessions: VisitSessionWithEmployee[]
  children: React.ReactNode
}

export function SessionsProvider({ initialSessions, children }: SessionsProviderProps) {
  const [sessions, setSessions] = useState<VisitSessionWithEmployee[]>(initialSessions)

  useEffect(() => {
    const supabase = createClient()

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
  }, [])

  return <SessionsContext.Provider value={sessions}>{children}</SessionsContext.Provider>
}
