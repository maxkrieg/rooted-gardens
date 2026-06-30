'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatElapsed } from '@/lib/utils/visits'

type InProgressVisit = {
  id: string
  started_at: string
  property: { address: string }
  visit_crew: Array<{ relation: string; employee: { name: string } | null }>
}

interface CrewsOnSitePanelProps {
  initialVisits: InProgressVisit[]
}

export function CrewsOnSitePanel({ initialVisits }: CrewsOnSitePanelProps) {
  const [visits, setVisits] = useState<InProgressVisit[]>(initialVisits)
  const [, setTick] = useState(0)

  // Tick elapsed time every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard_visits_inprogress')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits' },
        async (payload) => {
          const { id, started_at, ended_at } = payload.new as {
            id: string
            started_at: string | null
            ended_at: string | null
          }

          if (ended_at !== null || started_at === null) {
            // No longer in progress — remove
            setVisits((prev) => prev.filter((v) => v.id !== id))
            return
          }

          // Visit is in progress — fetch full details and upsert
          const { data } = await supabase
            .from('visits')
            .select(
              'id, started_at, property:properties(address), visit_crew(relation, employee:employees(name))',
            )
            .eq('id', id)
            .single()

          if (!data) return

          setVisits((prev) => {
            const filtered = prev.filter((v) => v.id !== id)
            return [...filtered, data as unknown as InProgressVisit]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (visits.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Crews on site now
      </h2>
      <div className="space-y-2">
        {visits.map((v) => {
          const assignedNames = v.visit_crew
            .filter((vc) => vc.relation === 'assigned' && vc.employee)
            .map((vc) => vc.employee!.name.split(' ')[0])
            .join(', ')

          return (
            <div
              key={v.id}
              className="rounded-xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.05] px-4 py-3 flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground leading-tight truncate">
                  {v.property?.address ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assignedNames || '—'}
                </p>
              </div>
              <span className="text-sm font-semibold text-[var(--clay)] tabular-nums shrink-0">
                {formatElapsed(v.started_at)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
