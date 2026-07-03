'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
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
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { useTodayTimeEntry } from '@/hooks/crew/useTodayTimeEntry'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

// datetime-local input expects "YYYY-MM-DDTHH:mm" in local time
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const MAX_PHOTO_BYTES = 20 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

interface CapturedPhoto {
  localUrl: string
  storagePath: string // empty string while upload is in-flight
}

interface VisitLoggerProps {
  visitId: string
  employeeId: string
  propertyId: string
  assignedCrew: Array<{ employee_id: string; name: string }>
  // The visit's start time, if the job was started. When set, the Start time field
  // is shown prefilled and editable; otherwise the crew can opt into a manual start.
  startedAt?: string | null
  // Pre-fill props for editing an existing completion
  initialServiceTypes?: string[]
  initialCompletionNote?: string
  initialPresentIds?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function VisitLogger({
  visitId,
  employeeId,
  propertyId,
  assignedCrew,
  startedAt,
  initialServiceTypes,
  initialCompletionNote,
  initialPresentIds,
  open,
  onOpenChange,
  onSuccess,
}: VisitLoggerProps) {
  const queryClient = useQueryClient()
  const { data: todayEntries = [] } = useTodayTimeEntry(employeeId)
  const { data: activeEmployees = [] } = useActiveEmployees()
  const isClockedIn = todayEntries.length > 0 && todayEntries[0].clock_out === null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [serviceTypeError, setServiceTypeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [presentIds, setPresentIds] = useState<string[]>([])
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  // Start time — required. Prefilled from the visit's started_at, or defaults to now
  // if the crew forgot to tap Start; either way they must confirm/set a value.
  const [startTime, setStartTime] = useState('')
  const [startTimeError, setStartTimeError] = useState(false)
  // End time — the completion timestamp (= visits.ended_at), prefilled to now; required.
  const [endTime, setEndTime] = useState('')
  const [endTimeError, setEndTimeError] = useState(false)
  const [presentIdsError, setPresentIdsError] = useState(false)

  // Seed state every time the sheet opens, using pre-fill values when editing
  useEffect(() => {
    if (open) {
      setPresentIds(initialPresentIds ?? assignedCrew.map((c) => c.employee_id))
      setServiceTypes(initialServiceTypes ?? [])
      setCompletionNote(initialCompletionNote ?? '')
      setEndTime(toDatetimeLocalValue(new Date().toISOString()))
      setStartTime(toDatetimeLocalValue(startedAt ?? new Date().toISOString()))
      setStartTimeError(false)
      setEndTimeError(false)
      setPresentIdsError(false)
    }
  }, [open, assignedCrew, startedAt, initialServiceTypes, initialCompletionNote, initialPresentIds])

  const crewOptions = activeEmployees.map((e) => ({ id: e.id, name: e.name, role: e.role }))

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].localUrl)
      next.splice(index, 1)
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
    setStartTimeError(false)
    setEndTime('')
    setEndTimeError(false)
    setPresentIdsError(false)
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.localUrl))
      return []
    })
    setPhotoError(null)
    setUploadingPhoto(false)
  }

  function handleOpenChange(next: boolean) {
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
  }

  async function handleSubmit() {
    if (!startTime) {
      setStartTimeError(true)
      return
    }
    if (!endTime) {
      setEndTimeError(true)
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

    // ended_at is the completion timestamp (and the visit's effective date).
    // started_at is recorded when the job was started, or set retroactively if the
    // crew entered a start time without tapping Start — it's required either way.
    const endedAt = new Date(endTime).toISOString()
    const startedAtISO = new Date(startTime).toISOString()

    await enqueueMutation('completion', {
      visitId,
      employeeId,
      presentEmployeeIds: presentIds,
      serviceTypes,
      completionNote: completionNote.trim() || undefined,
      startedAt: startedAtISO,
      endedAt,
    })

    // Enqueue metadata for each successfully uploaded photo
    for (const photo of photos.filter((p) => p.storagePath)) {
      await enqueueMutation('photo', {
        visitId,
        propertyId,
        storagePath: photo.storagePath,
        uploadedBy: employeeId,
        type: 'visit',
      })
    }

    // Flush mutations now — we know we're online because photo upload enforces it.
    // Without this, the photo row sits in the IDB queue until the next layout mount.
    await flushMutationQueue()

    // Invalidate stop-detail so photos appear if user navigates back to this stop,
    // and the week schedule so its in-progress pulse clears on completion.
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })

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
        },
      }
    })

    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Log Completion</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-4">
          {/* Start time — required; prefilled when the job was started, otherwise
              defaults to now so the crew can confirm/adjust it. */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="start-time">
              Start time <span className="text-destructive">*</span>
            </label>
            <input
              id="start-time"
              type="datetime-local"
              value={startTime}
              max={toDatetimeLocalValue(new Date().toISOString())}
              onChange={(e) => {
                setStartTime(e.target.value)
                if (e.target.value) setStartTimeError(false)
              }}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
            {startTimeError && (
              <p className="text-xs text-destructive">Start time is required.</p>
            )}
          </div>

          {/* End time — completion timestamp, prefilled to now; required */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="end-time">
              End time <span className="text-destructive">*</span>
            </label>
            <input
              id="end-time"
              type="datetime-local"
              value={endTime}
              max={toDatetimeLocalValue(new Date().toISOString())}
              onChange={(e) => {
                setEndTime(e.target.value)
                if (e.target.value) setEndTimeError(false)
              }}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
            {endTimeError && (
              <p className="text-xs text-destructive">End time is required.</p>
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
            {/* Hidden file input — capture="environment" opens rear camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handlePhotoCapture}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= 4 || uploadingPhoto || submitting}
            >
              <Camera className="h-4 w-4" />
              {uploadingPhoto
                ? 'Uploading…'
                : photos.length > 0
                  ? `Add Photo (${photos.length}/4)`
                  : 'Add Photo'}
            </Button>

            {photoError && (
              <p className="text-xs text-destructive">{photoError}</p>
            )}

            {/* Thumbnail strip */}
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((photo, i) => (
                  <div key={photo.localUrl} className="relative">
                    <img
                      src={photo.localUrl}
                      alt={`Photo ${i + 1}`}
                      className={[
                        'h-16 w-16 rounded-xl object-cover border border-[--border]',
                        !photo.storagePath ? 'opacity-50' : '',
                      ].join(' ')}
                    />
                    {photo.storagePath && (
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

        <SheetFooter className="flex-row gap-2 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background">
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
  )
}
