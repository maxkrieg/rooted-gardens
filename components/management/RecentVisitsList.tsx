'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VisitStatusBadge } from '@/components/management/badges'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { cn } from '@/lib/utils'
import type { Account, EmployeeRole, RecentVisit, VisitWithCrew } from '@/types/app'

interface RecentVisitsListProps {
  visits: RecentVisit[]
  account: Account
  role: EmployeeRole | undefined
}

/**
 * The account detail page's "Recent visits" list — same rendering as before, but
 * each row now opens the same VisitDetailSheet used by the schedule grid. Owns the
 * sheet's open/row state itself (mirroring ScheduleGrid/ScheduleListMobile), since
 * the sheet is a client-only concern the server-rendered account page can't hold.
 */
export function RecentVisitsList({ visits, account, role }: RecentVisitsListProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetVisit, setSheetVisit] = useState<RecentVisit | null>(null)

  function handleRowClick(visit: RecentVisit) {
    if (!visit.property) return // nothing to open without a property reference
    setSheetVisit(visit)
    setSheetOpen(true)
  }

  if (visits.length === 0) {
    return (
      <Card className="rounded-2xl border border-border shadow-warm">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="rounded-2xl border border-border shadow-warm overflow-hidden">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {visits.map((visit) => (
              <li key={visit.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(visit)}
                  disabled={!visit.property}
                  className={cn(
                    'w-full text-left px-4 py-3 min-h-[44px]',
                    'flex items-start justify-between gap-3',
                    'hover:bg-accent/20 active:bg-accent/30 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !visit.property && 'cursor-default',
                  )}
                >
                  <div className="min-w-0">
                    {/* Property address */}
                    <p className="text-sm font-medium text-foreground truncate">
                      {visit.property?.address ?? 'Unknown property'}
                    </p>
                    {/* Date */}
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      {visit.ended_at
                        ? format(parseISO(visit.ended_at), 'EEE MMM d, yyyy')
                        : `Week of ${format(parseISO(visit.week_start), 'EEE MMM d')}`}
                    </p>
                    {/* Service types */}
                    {visit.service_types && visit.service_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {visit.service_types.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[10px] h-4 px-1.5 border-border text-muted-foreground font-normal"
                          >
                            {type.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <VisitStatusBadge status={visit.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {sheetVisit?.property && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          row={{
            property: sheetVisit.property,
            account,
            visit: sheetVisit as VisitWithCrew,
          }}
          weekStart={sheetVisit.week_start}
          role={role}
        />
      )}
    </>
  )
}
