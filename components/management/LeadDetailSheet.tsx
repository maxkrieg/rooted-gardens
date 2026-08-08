'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, Download, Mail, MapPin, Phone, UserPlus } from 'lucide-react'
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
import { ConvertLeadSheet } from '@/components/management/ConvertLeadSheet'
import { getLeadResumeUrl, updateLeadStatus } from '@/app/management/leads/actions'
import { LEAD_SERVICE_INTEREST_LABELS_FULL } from '@/lib/validators/lead'
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/types/app'
import type { JobApplicationDetails, LeadWithConverted } from '@/types/app'

interface LeadDetailSheetProps {
  lead: LeadWithConverted | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Lead detail Sheet (task 9.8) — right-side slide-over, same shape as
 * RouteGroupSheet / EmployeeCard's edit sheet. `lead` stays non-null after
 * close (the parent only flips `open`, never clears the selection) so the
 * Sheet's own close animation has content to animate away, matching every
 * other sheet in the app.
 *
 * "Convert to Account" (task 9.9) opens ConvertLeadSheet on top of this one
 * for a service_inquiry that hasn't been converted yet; once converted, this
 * shows a link to the resulting account instead.
 */
export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const router = useRouter()
  const [statusPending, startStatus] = useTransition()
  const [resumePending, startResume] = useTransition()
  const [convertOpen, setConvertOpen] = useState(false)

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
    <>
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

          {/* Convert to account (service inquiries only) */}
          {lead.kind === 'service_inquiry' && (
            <div>
              {lead.converted_account_id ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Converted
                  </p>
                  <Link
                    href={`/management/accounts/${lead.converted_account_id}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    {lead.converted ? `Converted to ${lead.converted.name}` : 'View converted account'}
                  </Link>
                </>
              ) : (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setConvertOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Convert to Account
                </Button>
              )}
            </div>
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
        </div>
      </SheetContent>
    </Sheet>

    <ConvertLeadSheet
      lead={lead}
      open={convertOpen}
      onOpenChange={(next) => {
        setConvertOpen(next)
        if (!next) router.refresh()
      }}
    />
    </>
  )
}
