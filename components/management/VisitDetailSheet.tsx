'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, Map as MapIcon, X } from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { VisitDetailContent } from '@/components/VisitDetailContent'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { useStopDetail, type StopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { isVisitInProgress } from '@/lib/utils/visits'
import { useApplyVisitUpdate } from '@/hooks/useManagementSchedule'
import type { SchedulePropertyRow, VisitWithCrew } from '@/types/app'
import { emitTourEvent } from '@/lib/onboarding/events'

// routeGroup is never read in this component — callers without route-group context
// (e.g. the account detail page's Recent visits list) don't need to supply one.
type VisitDetailRow = Pick<SchedulePropertyRow, 'property' | 'account' | 'visit'>

interface VisitDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: VisitDetailRow
  weekStart: string
  /** The desktop board's right pane: the same detail, rendered in place instead of in a Sheet. */
  inline?: boolean
  /** `router.refresh()` on close. Server-rendered containers (billing) only: on a client-first
   *  page it refreshes an empty shell, and on weak signal the failed RSC fetch crashes it. */
  refreshOnClose?: boolean
}

/** Maps the schedule's row into useStopDetail's shape so both share one cache entry. */
function normalizeRow(row: VisitDetailRow): StopDetail | undefined {
  const v = row.visit
  if (!v) return undefined

  const assignedCrew = v.visit_crew
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => ({ employee_id: vc.employee_id, name: vc.employee!.name }))
  const completedBy = v.visit_crew
    .filter((vc) => vc.relation === 'completed' && vc.employee)
    .map((vc) => ({ employee_id: vc.employee_id, name: vc.employee!.name }))

  return {
    visitId: v.id,
    visit: {
      id: v.id,
      status: v.status,
      crew_instruction: v.crew_instruction,
      week_start: v.week_start,
      started_at: v.started_at,
      ended_at: v.ended_at,
      service_types: v.service_types,
      completion_note: v.completion_note,
      skip_reason: v.skip_reason,
      vehicle_id: v.vehicle_id,
      updated_at: v.updated_at,
    },
    // Populated from the schedule/account embed when present, so the invoice
    // badge shows immediately; useStopDetail's refetch backfills it otherwise.
    invoice: v.invoice ?? null,
    property: {
      id: row.property.id,
      address: row.property.address,
      frequency: row.property.frequency,
      preferred_interval_days: row.property.preferred_interval_days,
      crew_notes: row.property.crew_notes,
      access_notes: row.property.access_notes,
      parking_notes: row.property.parking_notes,
    },
    account: {
      id: row.account.id,
      name: row.account.name,
      billing_type: row.account.billing_type,
      contact_name: row.account.contact_name,
    },
    assignedCrew,
    completedBy,
    photos: [],
  }
}

export function VisitDetailSheet({
  open,
  onOpenChange,
  row: openedRow,
  weekStart: openedWeek,
  inline = false,
  refreshOnClose = false,
}: VisitDetailSheetProps) {
  const router = useRouter()

  // A past visit opened from "Earlier visits here". Same property and account, so it reuses
  // the row; dropped whenever the sheet closes or is pointed at another visit.
  const [historyVisit, setHistoryVisit] = useState<VisitWithCrew | null>(null)
  const [historyFor, setHistoryFor] = useState(openedRow.visit?.id)
  if (historyFor !== openedRow.visit?.id || (!open && historyVisit)) {
    setHistoryFor(openedRow.visit?.id)
    setHistoryVisit(null)
  }
  const row = useMemo(
    () => (historyVisit ? { ...openedRow, visit: historyVisit } : openedRow),
    [openedRow, historyVisit],
  )
  const weekStart = historyVisit?.week_start ?? openedWeek
  const scrollRef = useRef<HTMLDivElement>(null)

  function showVisit(visit: VisitWithCrew | null) {
    setHistoryVisit(visit && visit.id !== openedRow.visit?.id ? visit : null)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const visitId = row.visit?.id
  const initialData = useMemo(() => normalizeRow(row), [row])

  const { data: raw } = useStopDetail(visitId, { initialData })
  const applyVisitUpdate = useApplyVisitUpdate()

  // No overlay to merge any more: the drawer and the list read the same React
  // Query entries, and live updates are written into those (applyVisitUpdate).
  const data = raw

  // Push the drawer's state into the schedule cache so the cell behind the sheet repaints.
  // The version guard lets the server's refetch win over this write; no client timestamps.
  const visitForOverlay = raw?.visit
  useEffect(() => {
    if (!visitForOverlay) return
    applyVisitUpdate(visitForOverlay)
  }, [visitForOverlay, applyVisitUpdate])

  useEffect(() => {
    if (open) emitTourEvent('schedule.visitOpened')
    else emitTourEvent('schedule.visitClosed')
  }, [open])

  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  // See the guard in handleOpenChange: the lightbox unmounts before the trailing
  // event reaches this Sheet, so `photoViewerOpen` is already false by then.
  const photoClosedAt = useRef(0)

  function handlePhotoViewerChange(open: boolean) {
    if (!open) photoClosedAt.current = Date.now()
    setPhotoViewerOpen(open)
  }
  const { data: currentEmployee } = useCurrentEmployee()

  function handleOpenChange(next: boolean) {
    // The stacked lightbox's close reaches this sheet as an outside interaction; ignore it.
    if (!next && (photoViewerOpen || Date.now() - photoClosedAt.current < 500)) return
    // Refresh before onOpenChange: its replaceState can discard a refresh dispatched after it.
    if (!next && refreshOnClose && navigator.onLine) router.refresh()
    onOpenChange(next)
  }

  if (!data) return null

  // Defensive: a stale persisted cache entry (or a momentarily malformed embed)
  // could be missing these arrays even though StopDetail declares them required.
  const assignedCrew = data.assignedCrew ?? []
  const completedBy = data.completedBy ?? []

  // Full Mon–Sun span, not just the start date — the owner is placing this visit
  // in a week, and a lone start date makes them do the arithmetic.
  const weekStartDate = parseISO(weekStart)
  const weekRangeLabel = `${format(weekStartDate, 'EEE MMM d')} – ${format(addDays(weekStartDate, 6), 'EEE MMM d')}`

  // Radix's title/description need a Dialog around them; the pane has none.
  const Title = inline ? 'h2' : SheetTitle

  const header = (
    <>
      {/* pr-8 keeps the week chip clear of the close button, absolutely positioned top-right. */}
      <div className="flex items-center justify-between gap-3 pr-8">
        {/* The account owns the property, so it reads as an eyebrow above
            the address rather than trailing after it. */}
        <Link
          href={`/app/accounts/${row.account.id}`}
          className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[--primary] transition-colors"
        >
          {row.account.name}
        </Link>
        {/* Weekdays spelled out so the Mon–Sun boundaries are unmistakable. */}
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-[--accent-foreground] tabular-nums">
          <CalendarDays className="h-3 w-3 shrink-0" />
          {weekRangeLabel}
        </span>
      </div>

      <Title className="font-display text-xl font-semibold leading-snug text-foreground">
        {row.property.address}
      </Title>

      {!inline && (
        <SheetDescription className="sr-only">
          Visit at {row.property.address} for {row.account.name}, week of {weekRangeLabel}.
        </SheetDescription>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.property.address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapIcon className="h-3.5 w-3.5 shrink-0" />
            Open in Maps
          </a>
        </Button>
      </div>
    </>
  )

  const body = (
    <>
      {historyVisit && openedRow.visit && (
        <button
          type="button"
          onClick={() => showVisit(null)}
          className="-mt-2 mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to week of {format(parseISO(openedWeek), 'MMM d')}
        </button>
      )}
      <VisitDetailContent
        key={data.visitId}
        data={data}
        onOpenCompletion={() => setCompletionOpen(true)}
        onOpenSkip={() => setSkipOpen(true)}
        showAddress={false}
        showInvoice
        onPhotoViewerChange={handlePhotoViewerChange}
        onOpenHistoryVisit={showVisit}
      />
    </>
  )

  return (
    <>
      {inline ? (
        <section
          aria-label={`Visit at ${row.property.address}`}
          className="relative flex h-full min-h-0 flex-col"
        >
          <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 pt-5 pb-4">
            {header}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8"
            aria-label="Close stop (Esc)"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {body}
          </div>
        </section>
      ) : (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          {/* Send focus to body on close, or Radix can leave a stuck pointer-events lock. */}
          <SheetContent
            side="right"
            className="w-full sm:max-w-lg flex flex-col p-0 gap-0"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 gap-0 space-y-3">
              {header}
            </SheetHeader>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
              {body}
            </div>

            {/* Right-side sheets don't pad for the home indicator on a phone; the bottom variant
               does. */}
            <SheetFooter className="px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border shrink-0">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      <VisitLogger
        visitId={data.visitId}
        employeeId={currentEmployee?.id ?? ''}
        propertyId={data.property.id}
        assignedCrew={assignedCrew}
        startedAt={data.visit.started_at}
        weekStart={data.visit.week_start}
        initialServiceTypes={data.visit.service_types ?? undefined}
        initialCompletionNote={data.visit.completion_note ?? undefined}
        initialPhotos={data.photos.filter((p) => p.type === 'visit')}
        initialPresentIds={completedBy.length > 0 ? completedBy.map((c) => c.employee_id) : undefined}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={() => handleOpenChange(false)}
      />

      <SkipSheet
        visitId={data.visitId}
        employeeId={currentEmployee?.id ?? ''}
        inProgress={isVisitInProgress({ started_at: data.visit.started_at, ended_at: data.visit.ended_at })}
        initialSkipReason={data.visit.skip_reason ?? undefined}
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onSuccess={() => handleOpenChange(false)}
      />
    </>
  )
}
