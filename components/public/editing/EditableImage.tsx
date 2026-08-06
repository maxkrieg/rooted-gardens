'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { ImagePlus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validatePhotoFile } from '@/lib/utils/photos'
import { siteMediaPath, siteMediaPublicUrl } from '@/lib/utils/site-media'
import { cn } from '@/lib/utils'
import { useEditMode } from './EditModeProvider'

interface EditableImageProps {
  /** Current storage path within the `site-media` bucket, or null if none
   *  has been uploaded yet. */
  path: string | null
  /** Groups uploads for this field in the bucket browser — see
   *  lib/utils/site-media.ts. */
  scope: string
  alt: string
  /** The parent decides how the new path gets persisted: a standalone slot
   *  would call updateSiteSlot(kind:'image'); CollectionEditor folds it into
   *  the item's `data` ahead of that item's own Save. Bytes go straight
   *  browser → Storage, same reasoning as PhotoUploadDropzone — Server
   *  Action bodies are capped well below a 20 MB image. */
  onUploaded: (path: string) => void
  className?: string
}

/** Image counterpart to EditableText/EditableRichText (task 9.2.5). Its one
 *  in-scope wiring is the `team` collection's photo field via
 *  CollectionEditor — see the 9.2.5 plan's scope note on why no new page
 *  gets a hero image slot in this task. */
export function EditableImage({ path, scope, alt, onUploaded, className }: EditableImageProps) {
  const { canEdit, editing } = useEditMode()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const url = path ? siteMediaPublicUrl(path) : null

  async function handleFile(file: File | undefined) {
    if (!file) return
    const reason = validatePhotoFile(file)
    if (reason) {
      toast.error(`Could not use that image — ${reason}`)
      return
    }

    setUploading(true)
    const supabase = createClient()
    const storagePath = siteMediaPath(scope, file.type)
    const { error } = await supabase.storage.from('site-media').upload(storagePath, file)
    setUploading(false)

    if (error) {
      console.error('[EditableImage] upload', error)
      toast.error('Could not upload that image')
      return
    }

    onUploaded(storagePath)
  }

  if (!canEdit || !editing) {
    if (!url) return null
    return (
      <div className={cn('relative overflow-hidden rounded-lg', className)}>
        <Image src={url} alt={alt} fill className="object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group/edit relative overflow-hidden rounded-lg border border-dashed border-[var(--clay)]/50 bg-secondary',
        className,
      )}
    >
      {url ? (
        <Image src={url} alt={alt} fill className="object-cover" />
      ) : (
        <div className="flex h-full min-h-24 items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
          <ImagePlus className="h-5 w-5" />
          No photo yet
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 flex items-center justify-center bg-[var(--bark)]/0 text-sm font-medium text-transparent transition-colors group-hover/edit:bg-[var(--bark)]/50 group-hover/edit:text-white"
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Replace photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
