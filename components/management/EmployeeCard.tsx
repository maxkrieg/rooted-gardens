'use client'

import { useState, useTransition } from 'react'
import { Mail, Pencil, Phone, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmployeeRoleBadge } from '@/components/management/badges'
import { EmployeeForm } from '@/components/management/EmployeeForm'
import { inviteEmployee, setEmployeeSmsOptIn } from '@/app/management/team/actions'
import { SERVICE_SIDE_LABELS } from '@/lib/utils/team'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/app'

export function EmployeeCard({ employee }: { employee: Employee }) {
  const [editOpen, setEditOpen] = useState(false)
  const [invitePending, startInvite] = useTransition()
  const [smsPending, startSms] = useTransition()

  const hasAppAccess = Boolean(employee.user_id)
  const smsOptIn = !employee.sms_opt_out

  function handleInvite() {
    startInvite(async () => {
      const res = await inviteEmployee(employee.id)
      if (res.error) {
        toast.error('Could not send invite', { description: res.error })
      } else {
        toast.success('Invite sent', { description: `Magic link sent to ${employee.email}` })
      }
    })
  }

  function handleSmsToggle(next: boolean) {
    startSms(async () => {
      const res = await setEmployeeSmsOptIn(employee.id, next)
      if (res.error) toast.error('Could not update SMS setting', { description: res.error })
    })
  }

  return (
    <Card className={cn('rounded-2xl border border-border shadow-warm', !employee.active && 'opacity-60')}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground truncate">
              {employee.name}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {SERVICE_SIDE_LABELS[employee.side ?? ''] ?? '—'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <EmployeeRoleBadge role={employee.role} />
            {!employee.active && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1 text-sm">
          {employee.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate tabular-nums">{employee.phone}</span>
            </p>
          )}
          {employee.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{employee.email}</span>
            </p>
          )}
        </div>

        {/* App access */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                hasAppAccess ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
              aria-hidden
            />
            <span className={hasAppAccess ? 'text-foreground' : 'text-muted-foreground'}>
              {hasAppAccess ? 'Has app access' : 'No app access'}
            </span>
          </span>
          {!hasAppAccess && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!employee.email || invitePending}
              onClick={handleInvite}
            >
              {invitePending ? 'Sending…' : 'Invite to App'}
            </Button>
          )}
        </div>
        {!hasAppAccess && !employee.email && (
          <p className="text-xs text-muted-foreground -mt-1">Add an email to invite them.</p>
        )}

        {/* SMS consent + Edit */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
            SMS notifications
            <Switch
              checked={smsOptIn}
              onCheckedChange={handleSmsToggle}
              disabled={smsPending}
              aria-label="SMS notifications"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </CardContent>

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">Edit Employee</SheetTitle>
            <SheetDescription>Update the details for {employee.name}.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EmployeeForm employee={employee} onSuccess={() => setEditOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
