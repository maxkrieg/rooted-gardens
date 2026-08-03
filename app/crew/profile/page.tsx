'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Mail, Pencil, Phone, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileEditSheet } from '@/components/crew/ProfileEditSheet'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states/ErrorState'

export default function ProfilePage() {
  const router = useRouter()
  const { data: employee, isLoading, isError, refetch } = useCurrentEmployee()
  const [editOpen, setEditOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel = employee?.role
    ? employee.role.charAt(0).toUpperCase() + employee.role.slice(1)
    : null

  const smsOptIn = employee ? !employee.sms_opt_out : false

  // The name used to sit at a bare '…' forever on both a slow load and a hard
  // failure, with no way to tell them apart or to recover.
  if (isLoading && !employee) {
    return (
      <div className="p-4 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    )
  }

  if (isError && !employee) {
    return (
      <ErrorState
        title="Your profile didn't load."
        hint="You may be out of signal. Try again once you're back online."
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {employee?.name ?? '—'}
        </h1>
        {roleLabel && (
          <span className="inline-block text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {roleLabel}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-[--border] bg-card p-5 shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Your details
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 -mr-2"
            onClick={() => setEditOpen(true)}
            disabled={!employee}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>

        {/* Email — read-only (this is a contact field; login email is owner-managed) */}
        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
          <span className="truncate">{employee?.email ?? '—'}</span>
        </DetailRow>

        {/* Phone */}
        <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
          <span className="tabular-nums">{employee?.phone ?? '—'}</span>
        </DetailRow>

        {/* SMS notifications */}
        <DetailRow icon={<Smartphone className="h-4 w-4" />} label="Text alerts">
          <span
            className={[
              'inline-flex items-center text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
              smsOptIn ? 'status-completed' : 'bg-secondary text-muted-foreground',
            ].join(' ')}
          >
            {smsOptIn ? 'On' : 'Off'}
          </span>
        </DetailRow>

        {employee?.created_at && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-[--border]">
            Member since {format(parseISO(employee.created_at), 'MMM yyyy')}
          </p>
        )}
      </div>

      {/* Sign out */}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        Sign Out
      </Button>

      {employee && (
        <ProfileEditSheet
          initialPhone={employee.phone ?? ''}
          initialSmsOptIn={smsOptIn}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <span className="text-muted-foreground/70" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      <span className="text-sm text-foreground min-w-0 text-right">{children}</span>
    </div>
  )
}
