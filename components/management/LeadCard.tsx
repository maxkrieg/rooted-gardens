import { format, parseISO } from 'date-fns'
import { Calendar, Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LeadKindBadge, LeadStatusBadge } from '@/components/management/badges'
import { leadInterestOrPosition } from '@/lib/utils/leads'
import type { LeadWithAssignee } from '@/types/app'

/**
 * Mobile card for the leads inbox (task 9.8) — structural port of
 * AccountCard.tsx. Takes `onClick` rather than wrapping in a `<Link>`: lead
 * detail is a Sheet (LeadDetailSheet), not its own route.
 */
export function LeadCard({ lead, onClick }: { lead: LeadWithAssignee; onClick: () => void }) {
  const interestOrPosition = leadInterestOrPosition(lead)

  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      <Card className="rounded-2xl border border-border shadow-warm hover:shadow-warm-lg transition-shadow">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-foreground truncate">
                {lead.name}
              </p>
              {interestOrPosition && (
                <p className="text-sm text-muted-foreground truncate">{interestOrPosition}</p>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <LeadStatusBadge status={lead.status} />
              <LeadKindBadge kind={lead.kind} />
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {lead.email && (
              <span className="flex items-center gap-1 min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lead.email}</span>
              </span>
            )}
            {lead.phone && (
              <span className="flex items-center gap-1 tabular-nums">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {lead.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {format(parseISO(lead.created_at), 'EEE MMM d')}
            </span>
          </div>

          {lead.assigned && (
            <p className="mt-2 text-xs text-muted-foreground">Assigned to {lead.assigned.name}</p>
          )}
        </CardContent>
      </Card>
    </button>
  )
}
