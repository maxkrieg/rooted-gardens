'use client'

import { useMemo, useState, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { startImpersonation } from '@/app/admin/impersonate/actions'
import { finishIdentitySwitch, queueBlocksSwitch } from '@/components/admin/identity-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ImpersonateTarget {
  id: string
  name: string
  role: string
  side: string | null
  active: boolean
  hasLogin: boolean
  isSuperAdmin: boolean
}

export function ImpersonateList({ targets, live }: { targets: ImpersonateTarget[]; live: boolean }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return targets
    return targets.filter(
      (t) => t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q),
    )
  }, [targets, query])

  function impersonate(target: ImpersonateTarget) {
    setPendingId(target.id)
    startTransition(async () => {
      const blocked = await queueBlocksSwitch()
      if (blocked) {
        toast.error(blocked)
        setPendingId(null)
        return
      }
      if (!navigator.onLine) {
        toast.error('Impersonating needs a connection.')
        setPendingId(null)
        return
      }
      const result = await startImpersonation(target.id).catch(() => ({
        error: 'Impersonating needs a connection.',
        home: undefined,
      }))
      if (result.error !== undefined) {
        toast.error(result.error)
        setPendingId(null)
        return
      }
      await finishIdentitySwitch(queryClient, result.home)
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        You&apos;ll use the app exactly as they would, with their access. Everything you do is
        recorded under their name, and the Activity log marks it <em>via</em> you.
        {live && (
          <p className="mt-2 flex items-start gap-2 font-medium text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            This is production: changes are real, and pushing an invoice really sends it to
            QuickBooks.
          </p>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or role"
          aria-label="Search employees"
          className="h-11 pl-9 text-base"
        />
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {visible.map((target) => {
          const reason = target.isSuperAdmin
            ? 'Super admin'
            : !target.hasLogin
              ? 'No app login'
              : null
          return (
            <li key={target.id} className="flex items-center gap-3 px-4 py-3">
              <div className={cn('min-w-0 flex-1', !target.active && 'opacity-60')}>
                <p className="truncate font-medium text-foreground">{target.name}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {target.role}
                  {target.side ? ` · ${target.side}` : ''}
                  {!target.active ? ' · inactive' : ''}
                </p>
              </div>
              {reason ? (
                <span className="text-xs text-muted-foreground">{reason}</span>
              ) : (
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={pendingId !== null}
                  onClick={() => impersonate(target)}
                >
                  {pendingId === target.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Impersonate
                </Button>
              )}
            </li>
          )
        })}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No one matches.</li>
        )}
      </ul>
    </div>
  )
}
