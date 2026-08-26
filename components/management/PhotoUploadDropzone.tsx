'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { propertyPhotoPath, validatePhotoFile } from '@/lib/utils/photos'
import { createPropertyPhoto } from '@/app/app/(padded)/accounts/photo-actions'
import { useRefreshAccounts } from '@/hooks/useAccounts'

interface PhotoUploadDropzoneProps {
  accountId: string
  properties: { id: string; address: string }[]
  /** Reports the newest photo of a successful batch, so the gallery can open it
   *  for captioning and categorizing without a trip through the thumbnails. */
  onUploaded?: (photoId: string) => void
}

/**
 * Owner/lead upload for property-level how-to photos.
 *
 * One card for the whole tab rather than one per property section: the gallery
 * skips properties with no photos, so a per-section control would leave a brand
 * new property with no way to receive its first photo. The property selector
 * covers every property, empty or not.
 *
 * Image bytes go straight from the browser to Supabase Storage (gated by the
 * bucket's INSERT policy); only the resulting row is written through a Server
 * Action. Routing 20 MB through a Server Action would exceed both Next's default
 * body limit and the serverless request ceiling in production.
 */
export function PhotoUploadDropzone({
  accountId,
  properties,
  onUploaded,
}: PhotoUploadDropzoneProps) {
  const router = useRouter()
  const refreshAccounts = useRefreshAccounts()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave also fire for child elements, so a plain boolean flickers
  // as the pointer crosses them — count depth instead.
  const dragDepth = useRef(0)

  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

  const isUploading = progress !== null
  const singleProperty = properties.length === 1

  /** Takes a materialized File[] rather than a FileList: `input.files` is live,
   *  so resetting the input (which the change handler must do to allow re-picking
   *  the same file) would empty a FileList captured beforehand. */
  async function uploadFiles(files: File[]) {
    if (files.length === 0) return
    if (!propertyId) {
      toast.error('Add a property before uploading photos.')
      return
    }

    const rejected: string[] = []
    const accepted: File[] = []

    for (const file of files) {
      const reason = validatePhotoFile(file)
      if (reason) rejected.push(`${file.name} — ${reason}`)
      else accepted.push(file)
    }

    setSkipped(rejected)

    if (accepted.length === 0) {
      toast.error('No photos could be uploaded.')
      return
    }

    const supabase = createClient()
    let succeeded = 0
    let newestPhotoId: string | undefined
    const failures: string[] = []

    setProgress({ done: 0, total: accepted.length })

    for (const [index, file] of accepted.entries()) {
      setProgress({ done: index, total: accepted.length })

      const storagePath = propertyPhotoPath(propertyId, file.type)
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(storagePath, file)

      if (uploadError) {
        console.error('[PhotoUploadDropzone] upload', uploadError)
        failures.push(file.name)
        continue
      }

      const result = await createPropertyPhoto(accountId, {
        property_id: propertyId,
        storage_path: storagePath,
        type: 'how_to',
      })

      if (result.error) {
        console.error('[PhotoUploadDropzone] createPropertyPhoto', result.error)
        // The blob landed but the row didn't — clean it up so we don't leave an
        // object nothing references.
        await supabase.storage.from('photos').remove([storagePath])
        failures.push(file.name)
        continue
      }

      succeeded += 1
      // Last one wins: the gallery sorts newest-first, so opening the most
      // recent puts the whole batch within reach of the lightbox's next arrow.
      newestPhotoId = result.id ?? newestPhotoId
    }

    setProgress(null)

    if (succeeded > 0) {
      toast.success(succeeded === 1 ? 'Photo added' : `${succeeded} photos added`)
      // The action revalidates the path; refresh pulls the new RSC payload so the
      // server-rendered gallery re-renders with freshly signed URLs.
      refreshAccounts(accountId)
      router.refresh()
      // The gallery resolves this id against the refreshed data and opens the
      // lightbox once it arrives.
      if (newestPhotoId) onUploaded?.(newestPhotoId)
    }
    if (failures.length > 0) {
      toast.error(
        failures.length === 1
          ? `Could not upload ${failures[0]}`
          : `Could not upload ${failures.length} photos`,
      )
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (isUploading) return
    void uploadFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setIsDragging(false)
        }
      }}
      onDrop={handleDrop}
      className={cn(
        'rounded-2xl border border-dashed p-5 transition-colors',
        isDragging ? 'border-primary bg-accent' : 'border-border bg-card',
        isUploading && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-3">
        {!singleProperty && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Property
            </label>
            <Select value={propertyId} onValueChange={setPropertyId} disabled={isUploading}>
              <SelectTrigger className="h-11 text-base">
                <SelectValue placeholder="Choose a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col items-center text-center gap-2 py-2">
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-muted-foreground/40 animate-spin" />
              <p className="text-sm text-muted-foreground tabular-nums">
                Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </p>
            </>
          ) : (
            <>
              <ImagePlus className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {/* Drag-and-drop is a desktop enhancement; tap-to-pick is the
                    phone baseline, and owners are phone-primary. */}
                <span className="hidden sm:inline">Drag photos here, or </span>
                <span className="sm:hidden">Tap to add photos</span>
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose photos
              </Button>
              <p className="text-xs text-muted-foreground max-w-xs">
                Saved as How-To Guide photos — you can change a photo&apos;s category after
                uploading. JPEG, PNG, or WebP up to 20 MB.
              </p>
            </>
          )}
        </div>

        {skipped.length > 0 && (
          <div className="text-xs text-destructive">
            <p className="font-medium">Skipped {skipped.length}:</p>
            <ul className="mt-0.5 space-y-0.5">
              {skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* No `capture` attribute — unlike the crew inputs, an owner is picking from
          a library, and omitting it lets the phone offer camera *and* library. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          // Materialize BEFORE resetting the input — see uploadFiles.
          const files = Array.from(e.target.files ?? [])
          e.target.value = '' // reset so the same file can be picked again
          void uploadFiles(files)
        }}
      />
    </div>
  )
}
