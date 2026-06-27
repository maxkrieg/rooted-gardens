'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Camera, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { ServiceTypeSelector } from '@/components/crew/ServiceTypeSelector'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import type { TodayStop } from '@/hooks/crew/useTodayStops'

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
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function VisitLogger({
  visitId,
  employeeId,
  propertyId,
  assignedCrew,
  open,
  onOpenChange,
  onSuccess,
}: VisitLoggerProps) {
  const queryClient = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [actualDate, setActualDate] = useState(today)
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [serviceTypeError, setServiceTypeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [presentIds, setPresentIds] = useState<string[]>([])
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Pre-check all assigned crew every time the sheet opens
  useEffect(() => {
    if (open) {
      setPresentIds(assignedCrew.map((c) => c.employee_id))
    }
  }, [open, assignedCrew])

  function toggleCrewMember(empId: string) {
    setPresentIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].localUrl)
      next.splice(index, 1)
      return next
    })
  }

  function resetForm() {
    setActualDate(today)
    setServiceTypes([])
    setCompletionNote('')
    setServiceTypeError(false)
    setSubmitting(false)
    setPresentIds(assignedCrew.map((c) => c.employee_id))
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
    if (serviceTypes.length === 0) {
      setServiceTypeError(true)
      return
    }
    setSubmitting(true)

    // At minimum, credit the logger even if they unchecked themselves
    const presentEmployeeIds = presentIds.length > 0 ? presentIds : [employeeId]

    await enqueueMutation('completion', {
      visitId,
      employeeId,
      presentEmployeeIds,
      actualDate,
      serviceTypes,
      completionNote: completionNote.trim() || undefined,
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

    // Invalidate stop-detail so photos appear if user navigates back to this stop.
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })

    // Optimistic update: mark this visit completed in both caches immediately.
    // Use setQueryData rather than invalidating crew-today-stops to avoid a loading
    // flash on the today list when we redirect back to it.
    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
      if (!old) return old
      return {
        ...old,
        visit: {
          ...old.visit,
          status: 'completed',
          actual_date: actualDate,
          service_types: serviceTypes,
          completion_note: completionNote.trim() || null,
        },
      }
    })

    queryClient.setQueryData<TodayStop[]>(['crew-today-stops', employeeId], (old) => {
      if (!old) return old
      return old.map((stop) =>
        stop.visitId === visitId
          ? {
              ...stop,
              visit: {
                ...stop.visit,
                status: 'completed',
                actual_date: actualDate,
                service_types: serviceTypes,
                completion_note: completionNote.trim() || null,
              },
            }
          : stop
      )
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
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="completion-date">
              Date
            </label>
            <input
              id="completion-date"
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
          </div>

          {/* Who was on site — only shown when crew are assigned */}
          {assignedCrew.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">
                Who was on site?
              </label>
              <div className="rounded-2xl border border-[--border] bg-card divide-y divide-[--border] overflow-hidden">
                {assignedCrew.map((crew) => {
                  const checked = presentIds.includes(crew.employee_id)
                  return (
                    <label
                      key={crew.employee_id}
                      className={[
                        'flex items-center gap-3 px-4 min-h-[48px] cursor-pointer select-none transition-colors',
                        checked ? 'bg-accent' : 'hover:bg-accent/50',
                      ].join(' ')}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCrewMember(crew.employee_id)}
                        aria-label={crew.name}
                      />
                      <span className="text-sm font-medium text-foreground">{crew.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

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

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSubmit}
            disabled={submitting || uploadingPhoto}
          >
            {submitting ? 'Saving…' : 'Complete Stop'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
