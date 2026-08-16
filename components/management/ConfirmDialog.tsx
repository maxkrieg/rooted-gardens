'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  /** The control that opens the dialog — rendered via DialogTrigger asChild. */
  trigger: ReactNode
  title: string
  /** Body copy. A node (not just a string) so callers can bold the record's name. */
  description: ReactNode
  confirmLabel: string
  /** Shown on the confirm button while the action is in flight. */
  pendingLabel?: string
  pending?: boolean
  onConfirm: () => void
}

/**
 * Destructive-action confirmation.
 *
 * Built on the Dialog primitive rather than shadcn's AlertDialog because
 * @radix-ui/react-alert-dialog isn't a dependency of this project and a delete
 * confirmation isn't worth adding one for.
 *
 * The dialog stays open while `pending` is true and is closed by the caller's
 * revalidate/redirect on success — so a failed action leaves the dialog up with the
 * error toast, rather than dismissing and looking like it worked.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel = 'Deleting…',
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog
      open={open}
      // Don't let a backdrop click or Esc yank the dialog away mid-request.
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          <DialogDescription className="pt-1 leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
