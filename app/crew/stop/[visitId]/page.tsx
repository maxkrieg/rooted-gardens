'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Map, ChevronDown, KeyRound, ClipboardList, Car, Users, User, Play, Flag, SkipForward, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FrequencyBadge, VisitStatusBadge } from '@/components/management/badges'
import { useStopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { CrewAssignSheet } from '@/components/crew/CrewAssignSheet'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { createClient } from '@/lib/supabase/client'
import type { VisitSession } from '@/types/app'

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b border-[--border] px-4 py-3 flex items-center gap-3">
        <SkeletonBlock className="h-9 w-9 rounded-full" />
        <SkeletonBlock className="h-5 w-24" />
      </div>
      <div className="p-4 space-y-4">
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        <SkeletonBlock className="h-8 w-3/4" />
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-28 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function StopDetailPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: stop, isLoading } = useStopDetail(visitId)
  const { data: employee } = useCurrentEmployee()
  const [notesOpen, setNotesOpen] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  // Optimistic session so the Start cell flips to a running timer immediately,
  // before the queued insert syncs. Cleared once real data carries the session.
  const [optimisticSession, setOptimisticSession] = useState<
    { sessionId: string; startedAt: string; employeeId: string } | null
  >(null)

  // Re-render every 30s so the running duration on the Start cell stays current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const photoStoragePaths = stop?.photos.map((p) => p.storage_path) ?? []
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

  // Derive the display sessions from real data + any optimistic flip.
  // Must be before early returns to satisfy Rules of Hooks.
  // Use stop?.sessions (stable cache ref) as the dep rather than stop?.sessions ?? []
  // to avoid creating a new array on every render when stop is undefined.
  const stopSessions = stop?.sessions
  const effectiveSessions = useMemo((): VisitSession[] => {
    const rawSessions = (stopSessions ?? []) as VisitSession[]
    if (!optimisticSession) return rawSessions
    // Don't add a duplicate if the real data already carries an open session
    if (rawSessions.some((s) => s.ended_at === null)) return rawSessions
    return [
      ...rawSessions,
      {
        id: optimisticSession.sessionId,
        visit_id: visitId,
        started_at: optimisticSession.startedAt,
        ended_at: null,
        employee_id: optimisticSession.employeeId,
        source: 'crew_app',
        note: null,
        created_at: optimisticSession.startedAt,
        updated_at: optimisticSession.startedAt,
      } as unknown as VisitSession,
    ]
  }, [stopSessions, optimisticSession, visitId])

  const inProgress = isVisitInProgress(effectiveSessions)
  const activeSession = effectiveSessions.find((s) => s.ended_at === null)

  if (isLoading && !stop) return <LoadingSkeleton />

  if (!stop) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Stop not found.
      </div>
    )
  }

  const { visit, zone, property, account } = stop
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`
  const isActive = visit.status !== 'completed' && visit.status !== 'invoiced' && visit.status !== 'skipped'

  async function handleStart() {
    if (!employee?.id || inProgress) return
    const startedAt = new Date().toISOString()
    const sessionId = crypto.randomUUID()
    setOptimisticSession({ sessionId, startedAt, employeeId: employee.id })
    await enqueueMutation('job_start', { visitId, employeeId: employee.id, startedAt, sessionId })
    await flushMutationQueue()
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-today-stops'] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
  }

  const allZones = [...property.service_zones]
    .filter((z) => z.active)
    .sort((a, b) => a.sort_order - b.sort_order)
  const isMultiZone = account.billing_type === 'contract' || allZones.length > 1

  const hasPropertyNotes = !!(property.access_notes || property.crew_notes || property.parking_notes)

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[--border] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-2 shrink-0"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Stop Detail</span>
        </div>
        <span className="text-sm font-semibold text-foreground truncate max-w-[160px] text-right">
          {account.name}
        </span>
      </div>

      {/* Crew instruction banner */}
      {visit.crew_instruction && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#FBF0D6] border-b border-[--border]">
          <span className="w-1 shrink-0 self-stretch rounded-full mt-0.5" style={{ backgroundColor: 'var(--clay)' }} />
          <p className="font-display text-base font-semibold text-[--bark] leading-snug">
            {visit.crew_instruction}
          </p>
        </div>
      )}

      {/* Scrollable body — bottom padding clears the sticky action bar + bottom nav */}
      <div className="p-4 space-y-5 pb-52">

        {/* Address */}
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
            <Map className="h-3.5 w-3.5 shrink-0" />
            Open in Maps →
          </a>
          {account.contact_name && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{account.contact_name}</p>
            </div>
          )}
        </div>

        {/* Status row */}
        <div className="flex items-center gap-3">
          <VisitStatusBadge status={visit.status} />
          {inProgress && activeSession && (
            <div className="flex items-center gap-1.5" style={{ color: 'var(--clay)' }}>
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: 'var(--clay)' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: 'var(--clay)' }}
                />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide">
                On site · {formatElapsed(activeSession.started_at)}
              </span>
            </div>
          )}
        </div>

        {/* Zone context (single-zone: show the zone name + frequency) */}
        {!isMultiZone && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{zone.name}</span>
            <FrequencyBadge frequency={zone.frequency} />
          </div>
        )}

        {/* Assigned crew — viewable + editable by any crew member */}
        <div className="rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground">Assigned Crew</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setAssignOpen(true)}
            >
              Manage
            </Button>
          </div>
          <div className="border-t border-[--border] px-4 py-3">
            {stop.assignedCrew.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stop.assignedCrew.map((c) => (
                  <span
                    key={c.employee_id}
                    className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground"
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

        {/* Property notes — collapsible */}
        {hasPropertyNotes && (
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

        {/* Photos (completed visits) */}
        {stop.photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Photos
            </p>
            <div className="flex gap-2 flex-wrap">
              {stop.photos.map((photo, i) => {
                const url = signedPhotoUrls?.[i]
                return url ? (
                  <a key={photo.id} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={photo.caption ?? `Visit photo ${i + 1}`}
                      className="h-20 w-20 rounded-xl object-cover border border-[--border]"
                    />
                  </a>
                ) : (
                  <div key={photo.id} className="h-20 w-20 rounded-xl bg-muted animate-pulse" />
                )
              })}
            </div>
          </div>
        )}

        {/* Multi-zone list */}
        {isMultiZone && allZones.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
              This visit&apos;s zones
            </p>
            <div className="rounded-2xl border border-[--border] bg-card divide-y divide-[--border] shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
              {allZones.map((z) => (
                <div key={z.id} className="flex items-center justify-between px-4 py-3 min-h-[44px]">
                  <span className="text-sm font-medium text-foreground">{z.name}</span>
                  <FrequencyBadge frequency={z.frequency} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed action bar — three inline icon+label actions above the bottom nav */}
      <div
        className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-[--border] px-4 pt-2 pb-2"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-stretch gap-2">
          {/* Start — flips to a non-clickable running timer once started */}
          {inProgress && activeSession ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg border min-h-[60px] py-2"
              style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
              aria-label="Visit in progress"
            >
              <span className="font-display text-lg font-semibold leading-none tabular-nums">
                {formatElapsed(activeSession.started_at)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">On site</span>
            </div>
          ) : (
            <button
              type="button"
              className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
              onClick={handleStart}
              disabled={!isActive}
            >
              <Play className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-medium text-foreground">Start</span>
            </button>
          )}

          {/* Finish — opens the completion form, which also closes the session */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
            onClick={() => setCompletionOpen(true)}
            disabled={visit.status === 'completed' || visit.status === 'invoiced'}
          >
            {visit.status === 'completed' || visit.status === 'invoiced' ? (
              <>
                <Check className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-medium text-foreground">Done</span>
              </>
            ) : (
              <>
                <Flag className="h-5 w-5 text-foreground" />
                <span className="text-xs font-medium text-foreground">Finish</span>
              </>
            )}
          </button>

          {/* Skip */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
            onClick={() => setSkipOpen(true)}
            disabled={visit.status === 'skipped' || visit.status === 'invoiced'}
          >
            <SkipForward className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {visit.status === 'skipped' ? 'Skipped' : 'Skip'}
            </span>
          </button>
        </div>
      </div>

      <VisitLogger
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        propertyId={stop.property.id}
        assignedCrew={stop.assignedCrew ?? []}
        openSession={activeSession ? { id: activeSession.id, started_at: activeSession.started_at } : null}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={() => router.push('/crew/today')}
      />

      <SkipSheet
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onSuccess={() => router.push('/crew/today')}
      />

      <CrewAssignSheet
        visitId={visitId}
        assignedCrew={stop.assignedCrew ?? []}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </>
  )
}
