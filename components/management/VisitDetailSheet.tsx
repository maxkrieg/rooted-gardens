'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { CalendarDays, Map, Smartphone } from 'lucide-react'
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
import { useApplyVisitOverlay, useVisitOverlays } from '@/components/management/SessionsProvider'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { isVisitInProgress, mergeVisitOverlay } from '@/lib/utils/visits'
import type { EmployeeRole, SchedulePropertyRow } from '@/types/app'

// routeGroup is never read in this component — callers without route-group context
// (e.g. the account detail page's Recent visits list) don't need to supply one.
type VisitDetailRow = Pick<SchedulePropertyRow, 'property' | 'account' | 'visit'>

interface VisitDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: VisitDetailRow
  weekStart: string
}

/** Normalizes the schedule grid's raw DB-joined row into the same StopDetail
 *  shape the crew page's useStopDetail returns, so both containers feed
 *  VisitDetailContent identically and share one React Query cache entry. */
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

export function VisitDetailSheet({ open, onOpenChange, row, weekStart }: VisitDetailSheetProps) {
  const router = useRouter()
  const visitId = row.visit?.id
  const initialData = useMemo(() => normalizeRow(row), [row])

  const { data: raw } = useStopDetail(visitId, { initialData })

  // Merge the live overlay (management-only concern — the grid's SessionsProvider)
  // over the query result before handing data to the shared content.
  const visitOverlays = useVisitOverlays()
  const applyVisitOverlay = useApplyVisitOverlay()
  const data = useMemo(() => {
    if (!raw) return raw
    const merged = mergeVisitOverlay(raw.visit, visitOverlays)
    return merged === raw.visit ? raw : { ...raw, visit: merged }
  }, [raw, visitOverlays])

  // Push what the drawer knows back into the grid's overlay. Status writes here
  // are direct-client (no Server Action, no revalidatePath) and the close-time
  // router.refresh() has proven unreliable, so this is what actually repaints the
  // cell behind the sheet — including the revert-to-scheduled path, which never
  // closes the drawer at all.
  //
  // The optimistic cache write that lands first carries the *old* updated_at, so
  // mergeVisitOverlay rejects it; the refetch forced by the mutation's
  // invalidateQueries then arrives with the server's real updated_at and wins.
  // Deliberately not synthesizing a client timestamp — a fast client clock would
  // pin the overlay and start rejecting genuine later updates.
  //
  // Pushes `raw`, never `data`: `data` is the overlay already merged back in, so
  // feeding it here is a cycle by construction — every push mints a new merged
  // object that re-fires this effect. React Query's structural sharing keeps
  // `raw.visit` referentially stable until its contents actually change.
  const visitForOverlay = raw?.visit
  useEffect(() => {
    if (!visitForOverlay) return
    applyVisitOverlay(visitForOverlay)
  }, [visitForOverlay, applyVisitOverlay])

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

  // Only the still-server-rendered containers (billing's InvoicedHistory) need
  // this; the schedule and account pages read React Query, which the drawer's
  // writes patch directly. Offline it is worse than useless — the RSC fetch
  // fails and takes the page down with it.
  function handleOpenChange(next: boolean) {
    // Dismissing the photo lightbox must not close this sheet with it — both are
    // Radix overlays portaled to <body>, so the inner close reaches this one as
    // an outside interaction, arriving just after the lightbox has unmounted.
    if (!next && (photoViewerOpen || Date.now() - photoClosedAt.current < 500)) return
    // Refresh BEFORE onOpenChange: the parent's close handler runs
    // syncVisitUrlParam(null) → history.replaceState, which Next turns into a
    // router action of its own, and a refresh dispatched after it can be
    // discarded by that restore.
    if (!next && navigator.onLine) router.refresh()
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

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {/* When the Sheet closes while a Select trigger inside it holds focus, Radix's
            focus-restoration races with the closing subtree and can leave the page with a
            stuck pointer-events lock (cells become unclickable). preventDefault sends focus
            to document.body instead, which clears the lock. */}
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0 gap-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Identity block, read top-down: which account, which property, which
              week. The owner reopens this sheet constantly across properties and
              weeks, so all three answer at a glance before any action. */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 gap-0 space-y-3">
            {/* pr-8 keeps the week chip clear of the Sheet's own close button,
                which is absolutely positioned at top-right. */}
            <div className="flex items-center justify-between gap-3 pr-8">
              {/* The account owns the property, so it reads as an eyebrow above
                  the address rather than trailing after it. */}
              <Link
                href={`/app/accounts/${row.account.id}`}
                className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[--primary] transition-colors"
              >
                {row.account.name}
              </Link>
              {/* Weekdays are spelled out because the whole app thinks in Mon–Sun
                  weeks — "Mon … Sun" makes the boundaries unmistakable when
                  jumping between weeks. */}
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-[--accent-foreground] tabular-nums">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {weekRangeLabel}
              </span>
            </div>

            <SheetTitle className="font-display text-xl leading-snug">
              {row.property.address}
            </SheetTitle>

            <SheetDescription className="sr-only">
              Visit at {row.property.address} for {row.account.name}, week of {weekRangeLabel}.
            </SheetDescription>

            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.property.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Map className="h-3.5 w-3.5 shrink-0" />
                  Open in Maps
                </a>
              </Button>
              {/* The phone icon is the point: this is the stop exactly as crew see
                  it on their own phones. */}
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/app/stop/${data.visitId}`}>
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  Crew view
                </Link>
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <VisitDetailContent
              data={data}
              onOpenCompletion={() => setCompletionOpen(true)}
              onOpenSkip={() => setSkipOpen(true)}
              showAddress={false}
              showInvoice
              onPhotoViewerChange={handlePhotoViewerChange}
            />
          </div>

          {/* Bottom safe-area padding: a right-side sheet is full-width on a
              phone (w-full sm:max-w-lg) and sits flush against the home
              indicator on notched iPhones — the bottom variant handles this
              itself, but side="right" doesn't. */}
          <SheetFooter className="px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border shrink-0">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Close
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
