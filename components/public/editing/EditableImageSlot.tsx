'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateSiteSlot } from '@/app/(public)/actions'
import type { SitePage } from '@/types/app'
import { EditableImage } from './EditableImage'
import { useEditMode } from './EditModeProvider'

interface EditableImageSlotProps {
  page: SitePage
  slotKey: string
  /** Current storage path within `site-media`, or null if nothing's been
   *  uploaded to this slot yet. */
  path: string | null
  /** Groups this slot's uploads in the bucket browser, e.g. "home-hero_image". */
  scope: string
  alt: string
  className?: string
}

/**
 * Page-level image slot that saves itself via updateSiteSlot. Shows a botanical placeholder
 * before the first upload.
 */
export function EditableImageSlot({ page, slotKey, path, scope, alt, className }: EditableImageSlotProps) {
  const { canEdit, editing } = useEditMode()
  const router = useRouter()

  async function handleUploaded(newPath: string) {
    const result = await updateSiteSlot({ page, key: slotKey, kind: 'image', value: newPath })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Saved')
    router.refresh()
  }

  if (!canEdit || !editing) {
    if (!path) return null
    return <EditableImage path={path} scope={scope} alt={alt} onUploaded={() => {}} className={className} />
  }

  if (!path) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-[var(--clay)]/50 bg-secondary text-muted-foreground',
          className,
        )}
      >
        <ImagePlus className="h-5 w-5" aria-hidden />
        <span className="text-xs">No photo yet</span>
        <EditableImage path={null} scope={scope} alt={alt} onUploaded={handleUploaded} className="absolute inset-0" />
      </div>
    )
  }

  return <EditableImage path={path} scope={scope} alt={alt} onUploaded={handleUploaded} className={className} />
}
