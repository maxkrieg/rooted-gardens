'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { useHistoryStops } from '@/hooks/crew/useHistoryStops'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-14 shrink-0">
        <div className="h-4 w-12 rounded bg-muted" />
        <div className="mt-1 h-3 w-8 rounded bg-muted" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="flex gap-1.5 shrink-0">
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { data: employee } = useCurrentEmployee()
  const { data: stops, isLoading } = useHistoryStops(employee?.id)

  const isInitialLoad = isLoading && !stops

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-display text-2xl font-semibold text-foreground">History</h1>
      </div>

      {isInitialLoad && (
        <div className="divide-y divide-[--border]">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!isInitialLoad && stops?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
          <Clock className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-display text-lg font-semibold text-foreground">No history yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Completed stops will appear here.</p>
          </div>
        </div>
      )}

      {stops && stops.length > 0 && (
        <div className="divide-y divide-[--border]">
          {stops.map((stop) => {
            const dateStr = stop.actual_date ?? stop.week_start
            const formattedDate = format(parseISO(dateStr), 'EEE MMM d')
            const [dayPart, ...rest] = formattedDate.split(' ')
            const monthDay = rest.join(' ')

            return (
              <Link
                key={stop.visitId}
                href={`/crew/stop/${stop.visitId}`}
                className="flex items-center gap-3 px-4 min-h-[64px] py-3 active:bg-accent/60 transition-colors"
              >
                {/* Date */}
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-base font-semibold text-foreground leading-tight">
                    {monthDay}
                  </p>
                  <p className="text-xs text-muted-foreground">{dayPart}</p>
                </div>

                {/* Address + account */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{stop.address}</p>
                  <p className="text-xs text-muted-foreground truncate">{stop.accountName}</p>
                </div>

                {/* Service type badges */}
                {stop.service_types && stop.service_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0 justify-end max-w-[100px]">
                    {stop.service_types.map((t) => (
                      <span
                        key={t}
                        className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                      >
                        {SERVICE_TYPE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
