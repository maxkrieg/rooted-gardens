'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useIsOnline } from '@/hooks/use-hydrated'
import { formatElapsed } from '@/lib/utils/visits'

type InProgressVisit = {
  id: string
  started_at: string
  property: { address: string }
  visit_crew: Array<{ relation: string; employee: { name: string } | null }>
}

const IN_PROGRESS_SELECT =
  'id, started_at, property:properties!inner(address), visit_crew(relation, employee:employees(name))'

const inProgressKey = ['crews-on-site'] as const

/**
 * Who is on site right now. Deliberately NOT cached offline: a frozen list with
 * a pulsing dot and a timer that keeps counting for a crew who stopped an hour
 * ago is worse than saying we don't know.
 */
export function CrewsOnSitePanel() {
  const isOnline = useIsOnline()
  const queryClient = useQueryClient()
  const [, setTick] = useState(0)

  const { data: visits = [] } = useQuery({
    queryKey: inProgressKey,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('visits')
        .select(IN_PROGRESS_SELECT)
        .not('started_at', 'is', null)
        .is('ended_at', null)
        .eq('property.is_archived', false)
      if (error) throw error
      return (data ?? []) as unknown as InProgressVisit[]
    },
    enabled: isOnline,
    staleTime: 30_000,
  })

  // Tick elapsed time every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!isOnline) return
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
            queryClient.setQueryData<InProgressVisit[]>(inProgressKey, (prev) =>
              (prev ?? []).filter((v) => v.id !== id),
            )
            return
          }

          // Keep the archived-property filter the list query applies — without
          // it, realtime could re-add a visit the list deliberately excludes.
          const { data } = await supabase
            .from('visits')
            .select(IN_PROGRESS_SELECT)
            .eq('id', id)
            .eq('property.is_archived', false)
            .maybeSingle()
          if (!data) return

          queryClient.setQueryData<InProgressVisit[]>(inProgressKey, (prev) => [
            ...(prev ?? []).filter((v) => v.id !== id),
            data as unknown as InProgressVisit,
          ])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOnline, queryClient])

  if (!isOnline) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Crews on site now
        </h2>
        <div className="rounded-xl border border-dashed border-border px-4 py-3 flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Needs a connection — this one is live, so there&rsquo;s nothing saved to show.
          </p>
        </div>
      </section>
    )
  }

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
                <p className="text-xs text-muted-foreground mt-0.5">{assignedNames || '—'}</p>
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
