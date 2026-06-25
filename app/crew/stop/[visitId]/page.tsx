'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, ChevronDown, KeyRound, ClipboardList, Car } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FrequencyBadge, VisitStatusBadge } from '@/components/management/badges'
import { useStopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
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
  const { data: stop, isLoading } = useStopDetail(visitId)
  const { data: employee } = useCurrentEmployee()
  const [notesOpen, setNotesOpen] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)

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

  if (isLoading && !stop) return <LoadingSkeleton />

  if (!stop) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Stop not found.
      </div>
    )
  }

  const { visit, zone, property, account, sessions } = stop

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`
  const inProgress = isVisitInProgress(sessions as VisitSession[])
  const activeSession = sessions.find((s) => s.ended_at === null)

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
            className="ml-7 inline-flex items-center gap-1 text-sm font-medium text-[--primary] hover:underline"
          >
            Open in Maps →
          </a>
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

      {/* Fixed action bar — sits above the bottom nav */}
      <div
        className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-[--border] px-4 pt-3 pb-3 space-y-2"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={() => setCompletionOpen(true)}
          disabled={visit.status === 'completed' || visit.status === 'invoiced'}
        >
          {visit.status === 'completed' || visit.status === 'invoiced' ? 'Completed ✓' : 'Log Completion'}
        </Button>
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => {
            // Wired in task 4.6
          }}
        >
          Skip This Stop
        </Button>
      </div>

      <VisitLogger
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        propertyId={stop.property.id}
        assignedCrew={stop.assignedCrew ?? []}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={() => router.push('/crew/today')}
      />
    </>
  )
}
