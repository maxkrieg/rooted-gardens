'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { updateMyProfile } from '@/app/crew/profile/actions'

interface ProfileEditSheetProps {
  initialPhone: string
  initialSmsOptIn: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditSheet({
  initialPhone,
  initialSmsOptIn,
  open,
  onOpenChange,
}: ProfileEditSheetProps) {
  const queryClient = useQueryClient()
  const [phone, setPhone] = useState(initialPhone)
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn)
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    // Online-only (writes through a Server Action) — mirror the crew reassign guard.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Updating your profile needs a connection.')
      return
    }

    setSubmitting(true)
    const res = await updateMyProfile({ phone, smsOptIn })
    setSubmitting(false)

    if (res.error) {
      toast.error('Could not save your profile.', { description: res.error })
      return
    }

    toast.success('Profile updated')
    queryClient.invalidateQueries({ queryKey: ['current-employee'] })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Edit profile</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="profile-phone">
              Phone
            </label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(802) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
          </div>

          {/* SMS opt-in */}
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={smsOptIn}
              onCheckedChange={(v) => setSmsOptIn(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground">
              Receive text messages about schedule changes
              <span className="block text-xs text-muted-foreground mt-0.5">
                Turn this off to stop all SMS notifications.
              </span>
            </span>
          </label>
        </div>

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background space-y-2 flex-col">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
