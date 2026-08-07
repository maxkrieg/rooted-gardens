'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Download, Mail, MapPin, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LeadKindBadge, LeadStatusBadge } from '@/components/management/badges'
import { assignLead, getLeadResumeUrl, updateLeadStatus } from '@/app/management/leads/actions'
import { LEAD_SERVICE_INTEREST_LABELS_FULL } from '@/lib/validators/lead'
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/types/app'
import type { Employee, JobApplicationDetails, LeadWithAssignee } from '@/types/app'

interface LeadDetailSheetProps {
  lead: LeadWithAssignee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  assignees: Employee[]
}

/**
 * Lead detail Sheet (task 9.8) — right-side slide-over, same shape as
 * RouteGroupSheet / EmployeeCard's edit sheet. `lead` stays non-null after
 * close (the parent only flips `open`, never clears the selection) so the
 * Sheet's own close animation has content to animate away, matching every
 * other sheet in the app.
 *
 * No "Convert to Account" action here — that's task 9.9, not built yet.
 */
export function LeadDetailSheet({ lead, open, onOpenChange, assignees }: LeadDetailSheetProps) {
  const router = useRouter()
  const [statusPending, startStatus] = useTransition()
  const [assignPending, startAssign] = useTransition()
  const [resumePending, startResume] = useTransition()

  if (!lead) return null

  // Captured once as a plain string const: TS's null-narrowing on `lead`
  // (from the guard above) doesn't carry into the async closures below since
  // `lead` is a function parameter, not a `const` — but `leadId` is, so it
  // stays known-`string` inside them with no assertion needed.
  const leadId = lead.id

  const details =
    lead.kind === 'job_application' ? (lead.details as JobApplicationDetails | null) : null

  function handleStatusChange(next: string) {
    startStatus(async () => {
      const res = await updateLeadStatus(leadId, next)
      if (res.error) {
        toast.error('Could not update status', { description: res.error })
        return
      }
      router.refresh()
    })
  }

  function handleAssigneeChange(next: string) {
    startAssign(async () => {
      const res = await assignLead(leadId, next === 'none' ? null : next)
      if (res.error) {
        toast.error('Could not assign lead', { description: res.error })
        return
      }
      router.refresh()
    })
  }

  function handleDownloadResume() {
    startResume(async () => {
      const res = await getLeadResumeUrl(leadId)
      if (res.error || !res.url) {
        toast.error('Could not open résumé', { description: res.error })
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="font-display text-xl">{lead.name}</SheetTitle>
          <SheetDescription>
            Received {format(parseISO(lead.created_at), 'EEE MMM d, h:mm a')}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <LeadKindBadge kind={lead.kind} />
            <LeadStatusBadge status={lead.status} />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Contact */}
          <div className="space-y-1.5 text-sm">
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-2 text-foreground hover:underline"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {lead.email}
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-2 text-foreground hover:underline tabular-nums"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {lead.phone}
              </a>
            )}
            {lead.address && (
              <p className="flex items-center gap-2 text-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {lead.address}
              </p>
            )}
          </div>

          {/* Service interest (inquiry) / position (job application) */}
          {lead.kind === 'service_inquiry' && lead.service_interest && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Interested in
              </p>
              <p className="text-sm text-foreground">
                {LEAD_SERVICE_INTEREST_LABELS_FULL[
                  lead.service_interest as keyof typeof LEAD_SERVICE_INTEREST_LABELS_FULL
                ] ?? lead.service_interest}
              </p>
            </div>
          )}
          {lead.kind === 'job_application' && details?.position && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Position
              </p>
              <p className="text-sm text-foreground">{details.position}</p>
            </div>
          )}

          {/* Message */}
          {lead.message && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Message
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}

          {/* Résumé (job application only) */}
          {lead.kind === 'job_application' && details?.resume_path && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleDownloadResume}
              disabled={resumePending}
            >
              <Download className="h-4 w-4" />
              {resumePending ? 'Opening…' : 'Download résumé'}
            </Button>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Status
            </p>
            <Select value={lead.status} onValueChange={handleStatusChange} disabled={statusPending}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Assigned to
            </p>
            <Select
              value={lead.assigned_to ?? 'none'}
              onValueChange={handleAssigneeChange}
              disabled={assignPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
