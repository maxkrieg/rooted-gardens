'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatElapsed } from '@/lib/utils/visits'
import type { Employee, Property, ServiceZone, Visit, VisitSession, VisitSessionWithEmployee } from '@/types/app'

type SessionWithLocation = VisitSessionWithEmployee & {
  visit: Visit & { property: Property; service_zone: ServiceZone }
}

interface CrewsOnSitePanelProps {
  initialSessions: SessionWithLocation[]
}

export function CrewsOnSitePanel({ initialSessions }: CrewsOnSitePanelProps) {
  const [sessions, setSessions] = useState<SessionWithLocation[]>(initialSessions)
  const [, setTick] = useState(0)

  // Tick elapsed time every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard_visit_sessions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visit_sessions' },
        async (payload) => {
          const { data } = await supabase
            .from('visit_sessions')
            .select(
              '*, employee:employees(*), visit:visits(*, property:properties(*), service_zone:service_zones(*))'
            )
            .eq('id', payload.new.id)
            .single()
          if (data && data.ended_at === null) {
            setSessions((prev) => [...prev, data as unknown as SessionWithLocation])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visit_sessions' },
        (payload) => {
          if (payload.new.ended_at) {
            // Session closed — remove from the live panel
            setSessions((prev) => prev.filter((s) => s.id !== payload.new.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (sessions.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Crews on site now
      </h2>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.05] px-4 py-3 flex items-center gap-3"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground leading-tight truncate">
                {s.visit?.property?.address ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.employee?.name ?? '—'}
                {s.visit?.service_zone?.name ? ` · ${s.visit.service_zone.name}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--clay)] tabular-nums shrink-0">
              {formatElapsed(s.started_at)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
