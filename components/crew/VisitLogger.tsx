'use client'

import { useState, useEffect, useRef } from 'react'
import { addDays, endOfDay, format, min as minDate, parseISO, startOfDay } from 'date-fns'
import { Camera, ImagePlus, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { ServiceTypeSelector } from '@/components/crew/ServiceTypeSelector'
import { CrewMultiSelect } from '@/components/crew/CrewMultiSelect'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import { propertyHistoryKey } from '@/hooks/usePropertyHistory'
import type { VisitCrewWithEmployee } from '@/types/app'
import { createClient } from '@/lib/supabase/client'
import { MAX_PHOTO_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/utils/photos'
import { nextVisitVersion } from '@/lib/utils/visits'
import { PhotoLightbox, type LightboxPhoto } from '@/components/PhotoLightbox'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

// datetime-local input expects "YYYY-MM-DDTHH:mm" in local time
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

interface CapturedPhoto {
  // Set for a photo uploaded in a prior completion: its row exists, so it's never re-enqueued.
  id?: string
  localUrl?: string // object URL for a photo captured this session
  remoteUrl?: string // signed URL for a previously uploaded photo
  storagePath: string // empty string while a fresh capture's upload is in-flight
  createdAt?: string // only known for already-persisted photos
  // Captions are written on submit: a new photo has no `photos` row until the queue inserts it.
  caption?: string | null
  // What the caption was when the form opened, so submit only enqueues real edits.
  initialCaption?: string | null
}

interface VisitLoggerProps {
  visitId: string
  employeeId: string
  propertyId: string
  /** Property address, stored on each queued mutation so the "changes that
   *  didn't save" sheet can name the stop even with no connection. */
  label?: string
  assignedCrew: Array<{ employee_id: string; name: string }>
  // The visit's start time, if the job was started. When set, the Start time field
  // is shown prefilled and editable; otherwise the crew can opt into a manual start.
  startedAt?: string | null
  // The visit's scheduled week (always a Monday) — bounds Start/End to that week.
  weekStart: string
  // Pre-fill props for editing an existing completion
  initialServiceTypes?: string[]
  initialCompletionNote?: string
  initialPresentIds?: string[]
  initialPhotos?: Array<{
    id: string
    storage_path: string
    caption?: string | null
    created_at?: string
  }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function VisitLogger({
  visitId,
  employeeId,
  propertyId,
  label,
  assignedCrew,
  startedAt,
  weekStart,
  initialServiceTypes,
  initialCompletionNote,
  initialPresentIds,
  initialPhotos,
  open,
  onOpenChange,
  onSuccess,
}: VisitLoggerProps) {
  const queryClient = useQueryClient()
  const { data: activeEmployees = [] } = useActiveEmployees()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  // The visit's scheduled week bounds Start/End — Monday 00:00 through the earlier
  // of Sunday 23:59 or "now" (can't log a future completion either).
  const weekStartDate = startOfDay(parseISO(weekStart))
  const weekEndDate = endOfDay(addDays(weekStartDate, 6))
  const latestAllowed = minDate([new Date(), weekEndDate])

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [serviceTypeError, setServiceTypeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [presentIds, setPresentIds] = useState<string[]>([])
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  // Which photo the caption lightbox is showing, by index into `photos`.
  const [captionIndex, setCaptionIndex] = useState<number | null>(null)
  // When the lightbox last closed. Its trailing close event reaches this Sheet after it unmounts.
  const photoClosedAt = useRef(0)

  function closeCaption() {
    photoClosedAt.current = Date.now()
    setCaptionIndex(null)
  }

  function setPhotoCaption(index: number, caption: string) {
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, caption } : p)))
  }

  function toLightboxPhoto(photo: CapturedPhoto, i: number): LightboxPhoto {
    return {
      // A photo captured this session has no row yet, so its object URL stands in
      // as a stable key for the lightbox.
      id: photo.id ?? photo.localUrl ?? String(i),
      type: 'visit',
      // Only persisted photos know their real timestamp; one taken just now is
      // accurately "today".
      created_at: photo.createdAt ?? new Date().toISOString(),
      caption: photo.caption ?? null,
      url: photo.localUrl ?? photo.remoteUrl ?? null,
    }
  }
  // Required, within the visit's week. Prefilled from started_at, else the latest allowed time.
  const [startTime, setStartTime] = useState('')
  const [startTimeError, setStartTimeError] = useState<string | null>(null)
  // End time — the completion timestamp (= visits.ended_at), prefilled to the latest
  // allowed time; required, and must fall within the visit's scheduled week.
  const [endTime, setEndTime] = useState('')
  const [endTimeError, setEndTimeError] = useState<string | null>(null)
  const [presentIdsError, setPresentIdsError] = useState(false)

  function validateInWeek(value: string): string | null {
    if (!value) return 'This field is required.'
    const dt = new Date(value)
    if (dt < weekStartDate || dt > weekEndDate) {
      return `Must fall within the scheduled week (${format(weekStartDate, 'MMM d')}–${format(weekEndDate, 'MMM d')}).`
    }
    return null
  }

  // Seed state every time the sheet opens, using pre-fill values when editing
  useEffect(() => {
    if (open) {
      // Recomputed here so the effect depends only on `weekStart`.
      const openWeekEnd = endOfDay(addDays(startOfDay(parseISO(weekStart)), 6))
      const openLatestAllowed = minDate([new Date(), openWeekEnd])

      setPresentIds(initialPresentIds ?? assignedCrew.map((c) => c.employee_id))
      setServiceTypes(initialServiceTypes ?? [])
      setCompletionNote(initialCompletionNote ?? '')
      setEndTime(toDatetimeLocalValue(openLatestAllowed.toISOString()))
      setStartTime(toDatetimeLocalValue(startedAt ?? openLatestAllowed.toISOString()))
      setStartTimeError(null)
      setEndTimeError(null)
      setPresentIdsError(false)
      setCaptionIndex(null)

      // Previously uploaded photos get fresh signed URLs; they're already persisted.
      if (initialPhotos && initialPhotos.length > 0) {
        const supabase = createClient()
        Promise.all(
          initialPhotos.map(async (p) => {
            const { data } = await supabase.storage.from('photos').createSignedUrl(p.storage_path, 3600)
            return {
              id: p.id,
              storagePath: p.storage_path,
              remoteUrl: data?.signedUrl,
              createdAt: p.created_at,
              caption: p.caption ?? null,
              initialCaption: p.caption ?? null,
            }
          })
        ).then(setPhotos)
      } else {
        setPhotos([])
      }
    }
  }, [open, assignedCrew, startedAt, weekStart, initialServiceTypes, initialCompletionNote, initialPresentIds, initialPhotos])

  const crewOptions = activeEmployees.map((e) => ({ id: e.id, name: e.name, role: e.role }))

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed.localUrl) URL.revokeObjectURL(removed.localUrl)
      return next
    })
  }

  function resetForm() {
    setServiceTypes([])
    setCompletionNote('')
    setServiceTypeError(false)
    setSubmitting(false)
    setPresentIds(assignedCrew.map((c) => c.employee_id))
    setStartTime('')
    setStartTimeError(null)
    setEndTime('')
    setEndTimeError(null)
    setPresentIdsError(false)
    setPhotos((prev) => {
      prev.forEach((p) => {
        if (p.localUrl) URL.revokeObjectURL(p.localUrl)
      })
      return []
    })
    setPhotoError(null)
    setUploadingPhoto(false)
  }

  function handleOpenChange(next: boolean) {
    // Closing the stacked caption lightbox reaches this Sheet as an outside interaction and would
    // discard the form. The timestamp catches the trailing event.
    if (!next && (captionIndex !== null || Date.now() - photoClosedAt.current < 500)) return
    if (!next) resetForm()
    onOpenChange(next)
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input so the same file can be picked again if removed
    e.target.value = ''

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Photo is too large — max 20 MB.')
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Unsupported format — use JPEG, PNG, or WebP.')
      return
    }
    if (!navigator.onLine) {
      setPhotoError('Photos need a connection — connect and try again.')
      return
    }

    setPhotoError(null)
    const localUrl = URL.createObjectURL(file)
    const placeholder: CapturedPhoto = { localUrl, storagePath: '' }
    // The photo is appended, and only one upload runs at a time (the Add Photo
    // button is disabled while `uploadingPhoto`), so this is its final index.
    const newIndex = photos.length
    setPhotos((prev) => [...prev, placeholder])
    setUploadingPhoto(true)

    const storagePath = `photos/${propertyId}/${visitId}/${Date.now()}.jpg`
    const supabase = createClient()
    const { error } = await supabase.storage.from('photos').upload(storagePath, file)

    setUploadingPhoto(false)

    if (error) {
      URL.revokeObjectURL(localUrl)
      setPhotos((prev) => prev.filter((p) => p.localUrl !== localUrl))
      setPhotoError('Upload failed — please try again.')
      return
    }

    setPhotos((prev) =>
      prev.map((p) => (p.localUrl === localUrl ? { ...p, storagePath } : p))
    )

    // Straight into the photo so it can be captioned now, while the crew member
    // still remembers what they were pointing at.
    setCaptionIndex(newIndex)
  }

  async function handleSubmit() {
    const startErr = validateInWeek(startTime)
    if (startErr) {
      setStartTimeError(startErr)
      return
    }
    const endErr = validateInWeek(endTime)
    if (endErr) {
      setEndTimeError(endErr)
      return
    }
    if (presentIds.length === 0) {
      setPresentIdsError(true)
      return
    }
    if (serviceTypes.length === 0) {
      setServiceTypeError(true)
      return
    }
    setSubmitting(true)

    // ended_at is the completion date. started_at is required, set retroactively if Start was never
    // tapped.
    const endedAt = new Date(endTime).toISOString()
    const startedAtISO = new Date(startTime).toISOString()

    await enqueueMutation(
      'completion',
      {
        visitId,
        employeeId,
        presentEmployeeIds: presentIds,
        serviceTypes,
        completionNote: completionNote.trim() || undefined,
        startedAt: startedAtISO,
        endedAt,
      },
      label,
    )

    // Enqueue metadata for each newly captured photo — previously uploaded
    // photos (with an id, from initialPhotos) are already persisted.
    for (const photo of photos.filter((p) => !p.id && p.storagePath)) {
      await enqueueMutation(
        'photo',
        {
          visitId,
          propertyId,
          storagePath: photo.storagePath,
          uploadedBy: employeeId,
          type: 'visit',
          caption: photo.caption?.trim() || undefined,
        },
        label,
      )
    }

    // Captions edited on photos that were already persisted need their own
    // update — they aren't re-inserted above.
    for (const photo of photos.filter(
      (p) => p.id && (p.caption ?? '') !== (p.initialCaption ?? ''),
    )) {
      await enqueueMutation(
        'photo_caption',
        { photoId: photo.id!, caption: photo.caption?.trim() || null },
        label,
      )
    }

    // Flush mutations now — we know we're online because photo upload enforces it.
    // Without this, the photo row sits in the IDB queue until the next layout mount.
    const result = await flushMutationQueue()

    // A failed completion must not look saved (it would never be invoiced). Keep the form open.
    if (result.failed > 0) {
      setSubmitting(false)
      toast.error('That didn’t save.', {
        description: 'Check "Changes that didn’t save" at the top of the screen.',
      })
      return
    }

    // Invalidate stop-detail so photos appear if user navigates back to this stop,
    // and the week schedule so its in-progress pulse clears on completion.
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    queryClient.invalidateQueries({ queryKey: propertyHistoryKey(propertyId) })

    // The grid shows completed-by crew once a visit is done, and visit_crew rows
    // reach it through no other cache write.
    patchScheduleVisit(queryClient, visitId, (visit) => ({
      ...visit,
      status: 'completed',
      service_types: serviceTypes,
      started_at: startedAtISO,
      ended_at: endedAt,
      skip_reason: null,
      updated_at: nextVisitVersion(visit.updated_at),
      visit_crew: [
        ...visit.visit_crew.filter((vc) => vc.relation !== 'completed'),
        // Names from the full roster, not assignedCrew — someone can complete a
        // visit they were never assigned to.
        ...presentIds.map(
          (employeeId) =>
            ({
              visit_id: visitId,
              employee_id: employeeId,
              relation: 'completed',
              created_at: new Date().toISOString(),
              employee: activeEmployees.find((e) => e.id === employeeId) ?? null,
            }) as VisitCrewWithEmployee,
        ),
      ],
    }))

    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
      if (!old) return old
      return {
        ...old,
        visit: {
          ...old.visit,
          status: 'completed',
          service_types: serviceTypes,
          completion_note: completionNote.trim() || null,
          skip_reason: null,
          // Set the visit's timing; ended_at clears the "On site" indicator immediately
          started_at: startedAtISO,
          ended_at: endedAt,
          // Beat the row this replaces so the management grid's live overlay
          // takes it now rather than on the confirming refetch.
          updated_at: nextVisitVersion(old.visit.updated_at),
        },
      }
    })

    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* pb-0: the sticky footer owns the safe-area padding. */}
      <SheetContent side="bottom" className="px-0 pb-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Log Completion</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-4">
          {/* Start time: bounded to the visit's week (Mon–Sun, capped at now). */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="start-time">
              Start time <span className="text-destructive">*</span>
            </label>
            <input
              id="start-time"
              type="datetime-local"
              value={startTime}
              min={toDatetimeLocalValue(weekStartDate.toISOString())}
              max={toDatetimeLocalValue(latestAllowed.toISOString())}
              onChange={(e) => {
                setStartTime(e.target.value)
                if (e.target.value) setStartTimeError(null)
              }}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
            {startTimeError && (
              <p className="text-xs text-destructive">{startTimeError}</p>
            )}
          </div>

          {/* End time — completion timestamp, prefilled to the latest allowed time;
              required, bounded to the visit's scheduled week. */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="end-time">
              End time <span className="text-destructive">*</span>
            </label>
            <input
              id="end-time"
              type="datetime-local"
              value={endTime}
              min={toDatetimeLocalValue(weekStartDate.toISOString())}
              max={toDatetimeLocalValue(latestAllowed.toISOString())}
              onChange={(e) => {
                setEndTime(e.target.value)
                if (e.target.value) setEndTimeError(null)
              }}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
            {endTimeError && (
              <p className="text-xs text-destructive">{endTimeError}</p>
            )}
          </div>

          {/* Who was on site — full roster, assigned crew pre-selected; required */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Who was on site? <span className="text-destructive">*</span>
            </label>
            <CrewMultiSelect
              options={crewOptions}
              value={presentIds}
              onChange={(ids) => {
                setPresentIds(ids)
                if (ids.length > 0) setPresentIdsError(false)
              }}
            />
            {presentIdsError && (
              <p className="text-xs text-destructive">Select at least one crew member.</p>
            )}
          </div>

          {/* Service types */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Services performed <span className="text-destructive">*</span>
            </label>
            <ServiceTypeSelector
              value={serviceTypes}
              onChange={(types) => {
                setServiceTypes(types)
                if (types.length > 0) setServiceTypeError(false)
              }}
            />
            {serviceTypeError && (
              <p className="text-xs text-destructive">Select at least one service type.</p>
            )}
          </div>

          {/* Completion note */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="completion-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="completion-note"
              placeholder="Any details about this visit…"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              className="min-h-[80px] text-base resize-none"
            />
          </div>

          {/* Photo capture */}
          <div className="space-y-2">
            {/* Two inputs, not one: capture="environment" jumps straight to the
                rear camera, so the library needs its own input without it. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handlePhotoCapture}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoCapture}
            />

            {/* Camera-only when the primary pointer is a finger; CSS, so no hydration flash. */}
            <div className="grid grid-cols-1 pointer-coarse:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="hidden pointer-coarse:inline-flex h-11 gap-2"
                onClick={() => cameraInputRef.current?.click()}
                disabled={photos.length >= 4 || uploadingPhoto || submitting}
              >
                <Camera className="h-4 w-4" />
                {uploadingPhoto ? 'Uploading…' : 'Take Photo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => libraryInputRef.current?.click()}
                disabled={photos.length >= 4 || uploadingPhoto || submitting}
              >
                <ImagePlus className="h-4 w-4" />
                {uploadingPhoto ? (
                  'Uploading…'
                ) : (
                  <>
                    <span className="pointer-coarse:hidden">Add Photo</span>
                    <span className="hidden pointer-coarse:inline">Choose Photo</span>
                  </>
                )}
              </Button>
            </div>

            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground">{photos.length}/4 photos</p>
            )}

            {photoError && (
              <p className="text-xs text-destructive">{photoError}</p>
            )}

            {/* Thumbnail strip */}
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((photo, i) => (
                  <div key={photo.id ?? photo.localUrl ?? i} className="relative">
                    {/* Tapping opens the photo big with a caption field. */}
                    <button
                      type="button"
                      onClick={() => setCaptionIndex(i)}
                      disabled={!photo.storagePath}
                      aria-label={`Open photo ${i + 1} to add a caption`}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={photo.localUrl ?? photo.remoteUrl}
                        alt={`Photo ${i + 1}`}
                        className={[
                          'h-16 w-16 rounded-xl object-cover border border-[--border]',
                          !photo.storagePath ? 'opacity-50' : '',
                        ].join(' ')}
                      />
                    </button>
                    {photo.caption && (
                      <span
                        className="absolute bottom-0 inset-x-0 bg-foreground/70 text-background text-[9px] px-1 py-px rounded-b-xl truncate pointer-events-none"
                        aria-hidden
                      >
                        {photo.caption}
                      </span>
                    )}
                    {!photo.id && photo.storagePath && (
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky so Submit stays reachable above the on-screen keyboard. */}
        <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-[--border] bg-background px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 text-base font-semibold"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-12 text-base font-semibold"
            onClick={handleSubmit}
            disabled={submitting || uploadingPhoto}
          >
            {submitting ? 'Saving…' : 'Submit'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {/* Hoisted out of the Sheet rather than nested inside it — the same
        arrangement VisitDetailSheet uses for its own nested overlays. */}
    {captionIndex !== null && photos[captionIndex] && (
      <PhotoLightbox
        photos={photos.map(toLightboxPhoto)}
        index={captionIndex}
        onIndexChange={setCaptionIndex}
        onClose={closeCaption}
        footer={
          <LocalCaptionField
            value={photos[captionIndex].caption ?? ''}
            onChange={(caption) => setPhotoCaption(captionIndex, caption)}
            onDone={closeCaption}
          />
        }
      />
    )}
    </>
  )
}

/**
 * Caption input that writes to local form state, not the DB: the photo row doesn't exist until
 * submit. The Done button is the only feedback.
 */
function LocalCaptionField({
  value,
  onChange,
  onDone,
}: {
  value: string
  onChange: (value: string) => void
  onDone: () => void
}) {
  return (
    <div className="space-y-2 border-t border-[--border] pt-3">
      <label
        htmlFor="logger-caption"
        className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
      >
        Caption
      </label>
      <Textarea
        id="logger-caption"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What should someone notice in this photo?"
        rows={2}
        // ≥16px keeps iOS from zooming the viewport on focus.
        className="text-base"
      />
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-muted-foreground flex-1">
          {value.trim()
            ? 'Added — saved with the visit when you submit.'
            : 'Saved with the visit when you submit.'}
        </p>
        <Button type="button" className="h-11 px-6 shrink-0" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
