'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { VisitStatusBadge } from '@/components/management/badges'
import { SERVICE_TYPE_LABELS } from '@/types/app'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/** Past visits at this property, for the visit detail view. Collapsed, and silent when empty. */
export function PropertyVisitHistory({
  propertyId,
  beforeWeekStart,
}: {
  propertyId: string
  beforeWeekStart: string
}) {
  const [open, setOpen] = useState(false)
  const { data } = usePropertyVisitHistory(propertyId, beforeWeekStart)

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  if (total === 0) return null

  const remaining = total - rows.length

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-warm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-muted-foreground" />
          Visit History
          <span className="font-normal text-muted-foreground">({total})</span>
        </span>
        <ChevronDown
          className="h-4 w-4 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3.5">
          <ul className="border-l-2 border-border/60 pl-4 space-y-3.5">
            {rows.map((v) => {
              const note = v.completion_note ?? v.skip_reason

              return (
                <li key={v.id} className="relative">
                  {/* Neutral timeline dot — the badge already carries the color */}
                  <span className="absolute -left-[calc(1rem+1px)] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-border" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm text-foreground">
                      {format(parseISO(v.ended_at ?? v.week_start), 'MMM d')}
                    </span>
                    <VisitStatusBadge status={v.status} />
                  </div>
                  {v.service_types && v.service_types.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {v.service_types.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 border-border text-muted-foreground font-normal"
                        >
                          {SERVICE_TYPE_LABELS[t] ?? t.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {note && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{note}</p>
                  )}
                </li>
              )
            })}
          </ul>
          {remaining > 0 && (
            <p className="mt-3 pl-4 text-xs text-muted-foreground">
              +{remaining} earlier visit{remaining === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type PropertyVisitHistoryRow = {
  id: string
  status: string
  week_start: string
  ended_at: string | null
  service_types: string[] | null
  completion_note: string | null
  skip_reason: string | null
}

type PropertyVisitHistoryResult = {
  rows: PropertyVisitHistoryRow[]
  total: number // exact count of past visits at this property (excludes the current one)
}

const PAGE_SIZE = 5

/** Completed/skipped visits strictly before the current visit's week, newest first. */
function usePropertyVisitHistory(
  propertyId: string | undefined,
  beforeWeekStart: string | undefined
) {
  return useQuery<PropertyVisitHistoryResult>({
    queryKey: ['property-visit-history', propertyId, beforeWeekStart],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error, count } = await supabase
        .from('visits')
        .select(
          'id, status, week_start, ended_at, service_types, completion_note, skip_reason',
          { count: 'exact' }
        )
        .eq('property_id', propertyId!)
        .in('status', ['completed', 'skipped'])
        .lt('week_start', beforeWeekStart!)
        .order('week_start', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (error) throw error

      return {
        rows: (data ?? []) as PropertyVisitHistoryRow[],
        total: count ?? 0,
      }
    },
    enabled: !!propertyId && !!beforeWeekStart,
    staleTime: 30_000,
  })
}
