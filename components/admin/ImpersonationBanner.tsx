'use client'

import { useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, VenetianMask } from 'lucide-react'
import { toast } from 'sonner'
import { stopImpersonation } from '@/app/admin/impersonate/actions'
import { finishIdentitySwitch, queueBlocksSwitch } from '@/components/admin/identity-switch'
import { useRole } from '@/components/app/RoleProvider'
import { cn } from '@/lib/utils'

/**
 * Pinned to the top of every signed-in screen while a super admin is someone else. No dismiss:
 * forgetting whose session you're in is the whole risk.
 */
export function ImpersonationBanner() {
  const { impersonating } = useRole()
  const queryClient = useQueryClient()
  const [stopping, setStopping] = useState(false)
  const [, startTransition] = useTransition()

  if (!impersonating) return null

  function stop() {
    setStopping(true)
    startTransition(async () => {
      const blocked = await queueBlocksSwitch()
      if (blocked) {
        toast.error(blocked)
        setStopping(false)
        return
      }
      const result = await stopImpersonation().catch(() => null)
      if (!result || result.error !== undefined) {
        toast.error(result?.error ?? 'Stopping needs a connection.')
        setStopping(false)
        return
      }
      await finishIdentitySwitch(queryClient, result.home)
    })
  }

  return (
    <div
      role="status"
      className={cn(
        'sticky top-0 z-30 flex items-center gap-3 px-4 py-2 text-sm text-white',
        impersonating.live ? 'bg-destructive' : 'bg-[var(--clay)]',
      )}
    >
      <VenetianMask className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        {impersonating.live && <span className="font-semibold">Production · </span>}
        Viewing as <span className="font-semibold">{impersonating.name}</span>
        {impersonating.role && <span className="opacity-80"> ({impersonating.role})</span>}
      </p>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 font-semibold hover:bg-white/25 disabled:opacity-70"
      >
        {stopping && <Loader2 className="h-4 w-4 animate-spin" />}
        Stop
      </button>
    </div>
  )
}
