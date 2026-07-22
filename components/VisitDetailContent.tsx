'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MapPin,
  Map as MapIcon,
  User,
  ChevronDown,
  KeyRound,
  ClipboardList,
  Car,
  Truck,
  Users,
  Pencil,
  FilePen,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FrequencyBadge, VisitStatusBadge, InvoiceStatusBadge } from '@/components/management/badges'
import { qboInvoiceUrl } from '@/lib/utils/billing'
import { PropertyVisitHistory } from '@/components/PropertyVisitHistory'
import { CompletionSummary } from '@/components/crew/CompletionSummary'
import { CrewAssignSheet } from '@/components/crew/CrewAssignSheet'
import { CrewInstructionSheet } from '@/components/CrewInstructionSheet'
import { VisitPlanPhotos } from '@/components/crew/VisitPlanPhotos'
import { useActiveVehicles } from '@/hooks/crew/useActiveVehicles'
import { useUpdateVisitVehicle } from '@/hooks/crew/useUpdateVisitVehicle'
import { useRevertVisitToScheduled } from '@/hooks/crew/useRevertVisitToScheduled'
import { isVisitInProgress, isVisitMissed, formatElapsed } from '@/lib/utils/visits'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import type { EmployeeRole, VisitStatus } from '@/types/app'

const VISIT_STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'skipped']

interface VisitDetailContentProps {
  data: StopDetail
  role: EmployeeRole | undefined
  onOpenCompletion: () => void
  onOpenSkip: () => void
  /** False when the container already shows the address in its own header (the
   *  management Sheet) — avoids showing it twice. Defaults to true (crew page). */
  showAddress?: boolean
  /** Show the invoice status + QBO link section. Set true only by the management
   *  VisitDetailSheet; the crew stop page leaves it off, so invoice info never
   *  surfaces on the crew route (even for an owner/lead viewing it there). Still
   *  gated on owner/lead + a completed, invoiced visit inside. Defaults to false. */
  showInvoice?: boolean
}

/**
 * The shared visit-detail content — rendered inside both the management Sheet
 * and the crew stop page, styled after the crew page's design. Every edit is
 * immediate-write (no batch "Save Changes" form): each control persists on
 * change via a small direct-client mutation hook, same pattern as crew
 * reassignment (`useReassignCrew`) already used.
 *
 * `role === undefined` (still loading) renders the most-restrictive state —
 * every role-gated section stays hidden until role resolves.
 */
export function VisitDetailContent({
  data,
  role,
  onOpenCompletion,
  onOpenSkip,
  showAddress = true,
  showInvoice = false,
}: VisitDetailContentProps) {
  const { visit, property, account } = data
  // Defensive: a stale persisted cache entry (or a momentarily malformed embed)
  // could be missing these arrays even though StopDetail declares them required.
  const assignedCrew = data.assignedCrew ?? []
  const completedBy = data.completedBy ?? []
  const photos = data.photos ?? []

  const [notesOpen, setNotesOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [instructionOpen, setInstructionOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const canManage = role === 'owner' || role === 'lead'
  const canReassign = role === 'owner' || role === 'lead' || role === 'crew'
  const canEditCompletion = role !== 'accountant' && role !== undefined

  // A final visit's plan (instruction/crew/vehicle) is historical, not actionable —
  // the Plan card collapses to a glance summary and its inputs lock, same treatment
  // for completed and skipped.
  const isFinalVisit = visit.status === 'completed' || visit.status === 'skipped'

  const inProgress = isVisitInProgress({ started_at: visit.started_at, ended_at: visit.ended_at })
  const missed = isVisitMissed(visit) && !inProgress
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`
  const hasNotesSection = !!(
    property.access_notes || property.crew_notes || property.parking_notes || account.contact_name
  )

  const { data: vehicles = [] } = useActiveVehicles()
  const updateVehicle = useUpdateVisitVehicle(data.visitId)
  const revert = useRevertVisitToScheduled(data.visitId)

  const assignedVehicle = vehicles.find((v) => v.id === visit.vehicle_id)
  const planSummary = [
    assignedCrew.length > 0 ? `${assignedCrew.length} crew` : null,
    assignedVehicle?.name ?? null,
  ]
    .filter(Boolean)
    .join(', ') || 'No plan details'

  const photoStoragePaths = photos.map((p) => p.storage_path)
  const { data: signedPhotoUrls } = useQuery({
    queryKey: ['photo-urls', photoStoragePaths],
    queryFn: async () => {
      const supabase = createClient()
      return Promise.all(
        photoStoragePaths.map((path) =>
          supabase.storage
            .from('photos')
            .createSignedUrl(path, 3600)
            .then((r) => r.data?.signedUrl ?? null)
        )
      )
    },
    enabled: photoStoragePaths.length > 0,
    staleTime: 50 * 60 * 1000, // 50 min — well under the 1-hr signed URL expiry
  })

  // Signed URLs come back positional (aligned to photoStoragePaths), but the two
  // photo sections below each render a filtered subset — resolve by path so a
  // filtered subset stays correctly aligned with its URLs.
  const urlByPath = new Map<string, string | null | undefined>(
    photoStoragePaths.map((path, i) => [path, signedPhotoUrls?.[i]])
  )
  const completionPhotos = photos.filter((p) => p.type === 'visit')
  const planPhotos = photos.filter((p) => p.type === 'plan')

  function handleOfflineOrGenericError(err: unknown, genericMessage: string) {
    if (err instanceof Error && err.message === 'offline') {
      toast.error('This needs a connection.')
    } else {
      toast.error(genericMessage)
    }
  }

  function handleStatusSelect(next: VisitStatus) {
    if (next === visit.status) return
    if (next === 'skipped') {
      onOpenSkip()
      return
    }
    if (next === 'completed') {
      onOpenCompletion()
      return
    }
    // next === 'scheduled' — revert from skipped/completed
    revert.mutate(undefined, {
      onError: (err) => handleOfflineOrGenericError(err, 'Could not update status. Try again.'),
    })
  }

  return (
    <div className="space-y-5">

      {/* Address — hidden when the container (management Sheet) already shows it in its own header */}
      {showAddress && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-1 text-muted-foreground shrink-0" />
            <p className="font-display text-2xl font-semibold leading-snug text-foreground">
              {property.address}
            </p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-7 inline-flex items-center gap-1.5 text-sm font-medium text-[--primary] hover:underline"
          >
            <MapIcon className="h-3.5 w-3.5 shrink-0" />
            Open in Maps →
          </a>
        </div>
      )}

      {/* Status row — read-only display, shown to everyone */}
      <div className="flex items-center gap-3">
        {!canManage && <VisitStatusBadge status={visit.status} missed={missed} />}
        {inProgress && visit.started_at && (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--clay)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: 'var(--clay)' }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--clay)' }} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">
              On site · {formatElapsed(visit.started_at)}
            </span>
          </div>
        )}
      </div>

      {/* Status control — owner/lead only; hidden for crew, read-only (badge above) for accountant */}
      {canManage && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            {missed && <VisitStatusBadge status="scheduled" missed />}
          </div>
          <Select value={visit.status} onValueChange={(v) => handleStatusSelect(v as VisitStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  <VisitStatusBadge status={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Completion summary — near the top, shown when the visit is done */}
      {(visit.status === 'completed' || visit.status === 'skipped') && (
        <CompletionSummary
          visit={visit}
          completedBy={completedBy}
          photos={completionPhotos}
          photoUrls={completionPhotos.map((p) => urlByPath.get(p.storage_path))}
          canEdit={canEditCompletion}
          onEdit={onOpenCompletion}
          onEditSkip={onOpenSkip}
        />
      )}

      {/* Invoice — the billing outcome that follows completion. Management-only
          (showInvoice) and owner/lead-only (canManage); shown once the visit is on
          an invoice. Links out to the invoice in QuickBooks. */}
      {showInvoice && canManage && visit.status === 'completed' && data.invoice && (
        <div className="rounded-2xl border border-[--border] bg-card px-4 py-3 shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Invoice
            </span>
            <InvoiceStatusBadge status={data.invoice.status} withIcon />
          </div>
          {data.invoice.qbo_invoice_id && (
            <a
              href={qboInvoiceUrl(data.invoice.qbo_invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-[--primary] hover:underline"
            >
              QuickBooks invoice {data.invoice.qbo_invoice_id}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Plan — crew instruction, assigned crew, vehicle: what was arranged for this
          visit. Peer of Completion Log (stone header vs green/amber = "intent" vs
          "outcome"). Once the visit is final, collapses to a glance summary and every
          input locks — the plan is historical at that point, still worth a look but
          no longer actionable. */}
      <div className="rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
        {isFinalVisit ? (
          <button
            type="button"
            onClick={() => setPlanOpen((prev) => !prev)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
            style={{ backgroundColor: '#ECE8DF' }}
            aria-expanded={planOpen}
          >
            <span className="text-sm font-semibold text-[--bark] shrink-0">Visit Plan</span>
            <span className="text-xs text-muted-foreground truncate flex-1">· {planSummary}</span>
            <ChevronDown
              className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0"
              style={{ transform: planOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ backgroundColor: '#ECE8DF' }}>
            <span className="text-sm font-semibold text-[--bark]">Visit Plan</span>
          </div>
        )}

        {(!isFinalVisit || planOpen) && (
          <div className="border-t border-[--border] px-4 py-3.5 space-y-3.5">
            {/* Crew instruction */}
            <div className="flex items-start gap-3">
              <FilePen className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--clay)' }} />
              <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide mb-0.5"
                    style={{ color: 'var(--clay)' }}
                  >
                    Crew Instruction
                  </p>
                  {visit.crew_instruction ? (
                    <p className="font-display text-base font-semibold text-foreground leading-snug">
                      {visit.crew_instruction}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No crew instructions.</p>
                  )}
                </div>
                {canManage && !isFinalVisit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -mr-1 -mt-1 shrink-0"
                    onClick={() => setInstructionOpen(true)}
                    aria-label="Edit crew instruction"
                  >
                    <Pencil className="h-4 w-4" style={{ color: 'var(--clay)' }} />
                  </Button>
                )}
              </div>
            </div>

            {/* Assigned crew */}
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Assigned Crew
                  </p>
                  {canReassign && !isFinalVisit && (
                    <Button variant="outline" size="sm" className="h-8 -mt-1 shrink-0" onClick={() => setAssignOpen(true)}>
                      Manage
                    </Button>
                  )}
                </div>
                {assignedCrew.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedCrew.map((c) => (
                      <span
                        key={c.employee_id}
                        className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No crew assigned yet.</p>
                )}
              </div>
            </div>

            {/* Vehicle — crew + owner/lead editable; hidden control (plain text
                instead) for accountant, and once the visit is final */}
            <div className="flex items-start gap-3">
              <Truck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  Vehicle
                </p>
                {canReassign && !isFinalVisit ? (
                  <Select
                    value={visit.vehicle_id ?? 'none'}
                    onValueChange={(v) =>
                      updateVehicle.mutate(v === 'none' ? null : v, {
                        onError: (err) => handleOfflineOrGenericError(err, 'Could not update vehicle. Try again.'),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            <span>{v.name}</span>
                            {v.plate && <span className="text-xs text-muted-foreground">· {v.plate}</span>}
                            {v.status === 'maintenance' && (
                              <Badge variant="outline" className="text-[10px] status-skipped border-transparent ml-1">
                                Maintenance
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground leading-relaxed">
                    {assignedVehicle
                      ? `${assignedVehicle.name}${assignedVehicle.plate ? ` · ${assignedVehicle.plate}` : ''}`
                      : 'No vehicle assigned'}
                  </p>
                )}
              </div>
            </div>

            {/* Reference photos — owner/lead-managed, for crew to consult before/during the visit */}
            <VisitPlanPhotos
              visitId={data.visitId}
              propertyId={property.id}
              photos={planPhotos}
              urlByPath={urlByPath}
              canManage={canManage}
              isFinalVisit={isFinalVisit}
            />
          </div>
        )}
      </div>

      {/* Property notes — collapsible */}
      {hasNotesSection && (
        <div className="rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
          <button
            type="button"
            onClick={() => setNotesOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            aria-expanded={notesOpen}
          >
            <span className="text-sm font-semibold text-foreground">Property Notes</span>
            <ChevronDown
              className="h-4 w-4 text-muted-foreground transition-transform duration-200"
              style={{ transform: notesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {notesOpen && (
            <div className="border-t border-[--border] px-4 pb-4 space-y-3.5 pt-3.5">
              {account.contact_name && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Contact
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{account.contact_name}</p>
                  </div>
                </div>
              )}
              {property.access_notes && (
                <div className="flex items-start gap-3">
                  <KeyRound className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Access
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{property.access_notes}</p>
                  </div>
                </div>
              )}
              {property.crew_notes && (
                <div className="flex items-start gap-3">
                  <ClipboardList className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Crew Notes
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{property.crew_notes}</p>
                  </div>
                </div>
              )}
              {property.parking_notes && (
                <div className="flex items-start gap-3">
                  <Car className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Parking
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{property.parking_notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PropertyVisitHistory propertyId={property.id} beforeWeekStart={visit.week_start} />

      <CrewAssignSheet
        visitId={data.visitId}
        assignedCrew={assignedCrew}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      <CrewInstructionSheet
        visitId={data.visitId}
        initialInstruction={visit.crew_instruction}
        open={instructionOpen}
        onOpenChange={setInstructionOpen}
      />
    </div>
  )
}
