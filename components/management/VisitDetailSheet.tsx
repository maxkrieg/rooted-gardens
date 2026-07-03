'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Map } from 'lucide-react'
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
import { useVisitTimings } from '@/components/management/SessionsProvider'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { isVisitInProgress } from '@/lib/utils/visits'
import type { EmployeeRole, SchedulePropertyRow } from '@/types/app'

// routeGroup is never read in this component — callers without route-group context
// (e.g. the account detail page's Recent visits list) don't need to supply one.
type VisitDetailRow = Pick<SchedulePropertyRow, 'property' | 'account' | 'visit'>

interface VisitDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: VisitDetailRow
  weekStart: string
  role: EmployeeRole | undefined
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
      invoiced_at: v.invoiced_at,
    },
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

export function VisitDetailSheet({ open, onOpenChange, row, weekStart, role }: VisitDetailSheetProps) {
  const router = useRouter()
  const visitId = row.visit?.id
  const initialData = useMemo(() => normalizeRow(row), [row])

  const { data: raw } = useStopDetail(visitId, { initialData })

  // Merge the live realtime timing overlay (management-only concern — the grid's
  // SessionsProvider) over the query result before handing data to the shared content.
  const visitTimings = useVisitTimings()
  const data = useMemo(() => {
    if (!raw) return raw
    const overlay = visitTimings.get(raw.visitId)
    if (overlay === undefined) return raw
    return { ...raw, visit: { ...raw.visit, started_at: overlay.started_at, ended_at: overlay.ended_at } }
  }, [raw, visitTimings])

  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const { data: currentEmployee } = useCurrentEmployee()

  // Mutations inside VisitDetailContent are direct-client (no Server Action /
  // revalidatePath), so the server-rendered schedule grid needs an explicit
  // refresh to pick up anything changed while the sheet was open.
  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) router.refresh()
  }

  if (!data) return null

  // Defensive: a stale persisted cache entry (or a momentarily malformed embed)
  // could be missing these arrays even though StopDetail declares them required.
  const assignedCrew = data.assignedCrew ?? []
  const completedBy = data.completedBy ?? []

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
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-lg leading-tight">{row.property.address}</SheetTitle>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.property.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[--primary] hover:underline w-fit"
            >
              <Map className="h-3.5 w-3.5 shrink-0" />
              Open in Maps
            </a>
            <SheetDescription>
              <Link
                href={`/management/accounts/${row.account.id}`}
                className="font-medium text-[--primary] hover:underline"
              >
                {row.account.name}
              </Link>{' '}
              · Week of {format(parseISO(weekStart), 'MMM d')}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <VisitDetailContent
              data={data}
              role={role}
              onOpenCompletion={() => setCompletionOpen(true)}
              onOpenSkip={() => setSkipOpen(true)}
              showAddress={false}
            />
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border shrink-0">
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
