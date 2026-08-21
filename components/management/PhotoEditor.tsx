'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { photoTypeLabel } from '@/lib/utils/photos'
import {
  deletePropertyPhoto,
  updatePropertyPhoto,
} from '@/app/management/accounts/photo-actions'
import { PHOTO_TYPES, type PhotoType } from '@/types/app'
import { useRefreshAccounts } from '@/hooks/useAccounts'

/**
 * Owner/lead controls for a single photo: caption, category, delete.
 *
 * Injected into the shared `PhotoLightbox` as its `footer` slot, and lives here
 * rather than in that component because it calls Server Actions — the shared
 * lightbox also renders on `/crew/*`, where those are forbidden. Mount this
 * keyed by photo id so the caption draft resets when navigating photos.
 */
export function PhotoEditor({
  accountId,
  photo,
  onClose,
}: {
  accountId: string
  photo: { id: string; type: string; caption: string | null }
  onClose: () => void
}) {
  const router = useRouter()
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const refreshAccounts = useRefreshAccounts()

  const captionChanged = (photo.caption ?? '') !== caption

  function handleSaveCaption() {
    startTransition(async () => {
      const result = await updatePropertyPhoto(accountId, photo.id, { caption })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Caption saved')
      refreshAccounts(accountId)
      router.refresh()
    })
  }

  function handleTypeChange(next: string) {
    if (next === photo.type) return
    startTransition(async () => {
      const result = await updatePropertyPhoto(accountId, photo.id, {
        type: next as PhotoType,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Moved to ${photoTypeLabel(next)}`)
      refreshAccounts(accountId)
      router.refresh()
      // A type change re-partitions the groups, so this photo's index no longer
      // means what it did. Closing is simpler and less surprising than trying to
      // track it across the re-sort.
      onClose()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePropertyPhoto(accountId, photo.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Photo deleted')
      refreshAccounts(accountId)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-1.5">
        <label
          htmlFor="photo-caption"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
        >
          Caption
        </label>
        <Textarea
          id="photo-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe what crew should notice here…"
          rows={2}
          className="text-base"
        />
        <Button
          type="button"
          size="sm"
          disabled={!captionChanged || isPending}
          onClick={handleSaveCaption}
        >
          Save caption
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Category
        </label>
        <Select value={photo.type} onValueChange={handleTypeChange} disabled={isPending}>
          <SelectTrigger className="h-11 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {photoTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t border-border pt-3">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">Delete this photo?</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete photo
          </Button>
        )}
      </div>
    </div>
  )
}
