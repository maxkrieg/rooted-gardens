'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VisitStatusBadge } from '@/components/management/badges'
import { cn } from '@/lib/utils'
import { FilePen } from 'lucide-react'
import { saveVisitChanges, skipVisit } from '@/app/management/schedule/actions'
import { setVisitTimes } from '@/app/management/schedule/session-actions'
import { useVisitTimings } from '@/components/management/SessionsProvider'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { visitUpdateSchema, type VisitUpdateValues } from '@/lib/validators/visit'
import type { Employee, SchedulePropertyRow, Vehicle, VisitStatus } from '@/types/app'

const VISIT_STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'skipped', 'invoiced']

// datetime-local input expects "YYYY-MM-DDTHH:mm" in local time
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

// ─── Elapsed ticker ───────────────────────────────────────────────────────────

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [startedAt])
  return (
    <span className="text-sm font-medium text-[var(--clay)] tabular-nums">
      {formatElapsed(startedAt)}
    </span>
  )
}

// ─── Timing section ───────────────────────────────────────────────────────────

interface TimingSectionProps {
  visitId: string  // used for setVisitTimes server action call
  startedAt: string | null
  endedAt: string | null
  assignedCrew: Array<{ name: string }>
  canEdit: boolean
}

function TimingSection({ visitId, startedAt, endedAt, assignedCrew, canEdit }: TimingSectionProps) {
  const inProgress = isVisitInProgress({ started_at: startedAt, ended_at: endedAt })

  // Initialize from the visit's current timing. The parent passes key={visitId} so
  // this component remounts when the sheet opens for a different visit, keeping these
  // values fresh without needing a sync effect.
  const [editStartedAt, setEditStartedAt] = useState(
    () => startedAt ? toDatetimeLocalValue(startedAt) : '',
  )
  const [editEndedAt, setEditEndedAt] = useState(
    () => endedAt ? toDatetimeLocalValue(endedAt) : '',
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const startISO = editStartedAt ? new Date(editStartedAt).toISOString() : null
    const endISO = editEndedAt ? new Date(editEndedAt).toISOString() : null
    const res = await setVisitTimes(visitId, startISO, endISO)
    setSaving(false)
    if (res.error) {
      toast.error('Failed to update timing', { description: res.error })
    } else {
      toast.success('Timing updated')
    }
  }

  if (!startedAt && !canEdit) return null

  return (
    <div className="space-y-3">
      {/* On site now indicator */}
      {inProgress && startedAt && (
        <div className="rounded-lg bg-[var(--clay)]/[0.08] border border-[var(--clay)]/30 px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
              <span className="text-sm font-semibold text-[var(--clay)]">On site now</span>
            </div>
            <ElapsedTime startedAt={startedAt} />
          </div>
          {assignedCrew.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {assignedCrew.map((e) => e.name.split(' ')[0]).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Editable timing fields — owner/lead only */}
      {canEdit ? (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Timing
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start time</label>
              <input
                type="datetime-local"
                value={editStartedAt}
                onChange={(e) => setEditStartedAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                End time <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={editEndedAt}
                onChange={(e) => setEditEndedAt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Update Timing'}
          </Button>
        </div>
      ) : startedAt ? (
        /* Read-only display when not editable but timing exists */
        <div className="space-y-1.5 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Start</p>
            <p className="text-foreground tabular-nums">
              {format(parseISO(startedAt), 'EEE, MMM d · h:mm a')}
            </p>
          </div>
          {endedAt && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">End</p>
              <p className="text-foreground tabular-nums">
                {format(parseISO(endedAt), 'EEE, MMM d · h:mm a')}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ─── Service type labels ──────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface VisitDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SchedulePropertyRow
  weekStart: string
  employees: Employee[]
  vehicles: Vehicle[]
  canEdit: boolean
}

export function VisitDetailSheet({
  open,
  onOpenChange,
  row,
  weekStart,
  employees,
  vehicles,
  canEdit,
}: VisitDetailSheetProps) {
  const visit = row.visit

  const form = useForm<VisitUpdateValues>({
    resolver: zodResolver(visitUpdateSchema),
    defaultValues: {
      status: 'scheduled',
      crew_instruction: '',
      vehicle_id: null,
      assigned_crew_ids: [],
    },
  })

  const { reset } = form

  useEffect(() => {
    if (visit) {
      reset({
        status: visit.status as VisitStatus,
        crew_instruction: visit.crew_instruction ?? '',
        vehicle_id: visit.vehicle_id ?? null,
        assigned_crew_ids: visit.visit_crew
          .filter((vc) => vc.relation === 'assigned')
          .map((vc) => vc.employee_id),
      })
    }
  }, [visit, reset])

  // Merge live realtime timing overlay with the server-fetched visit data
  const visitTimings = useVisitTimings()
  const timingOverride = visit ? visitTimings.get(visit.id) : undefined
  const effectiveStartedAt =
    timingOverride !== undefined ? timingOverride.started_at : (visit?.started_at ?? null)
  const effectiveEndedAt =
    timingOverride !== undefined ? timingOverride.ended_at : (visit?.ended_at ?? null)

  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [previousStatus, setPreviousStatus] = useState<VisitStatus>('scheduled')
  const [, startTransition] = useTransition()

  function handleStatusChange(newValue: string) {
    if (newValue === 'skipped') {
      setPreviousStatus(form.getValues('status'))
      form.setValue('status', 'skipped')
      setSkipReason('')
      setSkipDialogOpen(true)
    } else {
      form.setValue('status', newValue as VisitStatus)
    }
  }

  function handleSkipCancel() {
    form.setValue('status', previousStatus)
    setSkipDialogOpen(false)
  }

  function handleConfirmSkip() {
    if (!visit) return
    startTransition(async () => {
      const res = await skipVisit(visit.id, skipReason.trim() || undefined)
      if (res.error) {
        toast.error('Failed to skip visit', { description: res.error })
        form.setValue('status', previousStatus)
        return
      }
      setSkipDialogOpen(false)
      onOpenChange(false)
      toast.success('Visit skipped')
    })
  }

  async function onSubmit(values: VisitUpdateValues) {
    if (!visit) return
    const res = await saveVisitChanges(visit.id, values)
    if (res.error) {
      toast.error('Failed to save changes', { description: res.error })
      return
    }
    toast.success('Visit updated')
    onOpenChange(false)
  }

  if (!visit) return null

  const crewEmployees = employees.filter((emp) => emp.role === 'crew')
  const assignedCrew = visit.visit_crew
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => vc.employee!)

  return (
    <>
      <Dialog open={skipDialogOpen} onOpenChange={(o) => { if (!o) handleSkipCancel() }}>
        {/* Opens programmatically from inside the Sheet (no trigger to restore focus to).
            preventDefault on close hands focus to the browser instead of Radix trying to
            restore it into a tearing-down subtree — avoids the page-wide pointer-events lock. */}
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Skip this visit?</DialogTitle>
            <DialogDescription>
              {row.property.address} · Week of {format(parseISO(weekStart), 'MMM d')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Reason (optional)"
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSkipCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmSkip}>
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* When the Sheet closes while a Select trigger inside it holds focus, Radix's
            focus-restoration races with the closing subtree and can leave the page with a
            stuck pointer-events lock (cells become unclickable). preventDefault sends focus
            to document.body instead, which clears the lock. */}
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0 gap-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-lg leading-tight">{row.property.address}</SheetTitle>
            <SheetDescription>
              {row.account.name} · Week of {format(parseISO(weekStart), 'MMM d')}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              id="visit-detail-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
            >
              {/* Timing: on-site indicator + editable start/end.
                  key={visit.id} forces remount when the sheet opens for a different visit,
                  so lazy-initialized edit fields stay in sync without a setState effect. */}
              <TimingSection
                key={visit.id}
                visitId={visit.id}
                startedAt={effectiveStartedAt}
                endedAt={effectiveEndedAt}
                assignedCrew={assignedCrew}
                canEdit={canEdit}
              />

              {/* Status — top of form */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      disabled={!canEdit}
                      value={field.value}
                      onValueChange={handleStatusChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VISIT_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            <VisitStatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Skip reason — shown below status when visit is skipped and reason exists */}
              {visit.status === 'skipped' && visit.skip_reason && (
                <p className="text-sm text-[#9a6b16] bg-[#fbf0d6] border border-[#d9a441]/40 rounded-lg px-3 py-2 -mt-3">
                  {visit.skip_reason}
                </p>
              )}

              {/* Crew Instruction */}
              <div
                className={cn(
                  'rounded-lg -mx-1 px-1',
                  visit.crew_instruction &&
                    'bg-[var(--clay)]/[0.08] border border-[var(--clay)]/30 px-3 py-3',
                )}
              >
                <FormField
                  control={form.control}
                  name="crew_instruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        {visit.crew_instruction && (
                          <FilePen className="w-4 h-4 text-[var(--clay)] shrink-0" />
                        )}
                        Crew Instruction
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          disabled={!canEdit}
                          placeholder="Add a note for crew…"
                          className="resize-none"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Assigned Crew */}
              <FormField
                control={form.control}
                name="assigned_crew_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Crew</FormLabel>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {crewEmployees.length === 0 && (
                        <p className="text-sm text-muted-foreground px-3 py-2.5">
                          No active crew members.
                        </p>
                      )}
                      {crewEmployees.map((emp) => {
                        const checked = field.value.includes(emp.id)
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!canEdit}
                              onCheckedChange={(c) => {
                                const next = c
                                  ? [...field.value, emp.id]
                                  : field.value.filter((id) => id !== emp.id)
                                field.onChange(next)
                              }}
                            />
                            <span className="text-sm font-medium text-foreground flex-1 select-none">
                              {emp.name}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize select-none">
                              {emp.role}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vehicle */}
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select
                      disabled={!canEdit}
                      value={field.value ?? 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            <span className="flex items-center gap-2">
                              <span>{v.name}</span>
                              {v.plate && (
                                <span className="text-xs text-muted-foreground">· {v.plate}</span>
                              )}
                              {v.status === 'maintenance' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] status-skipped border-transparent ml-1"
                                >
                                  Maintenance
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Completion details — read-only */}
              {visit.status === 'completed' && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Completion Details</h3>
                  {effectiveEndedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                        Date completed
                      </p>
                      <p className="text-sm text-foreground">
                        {format(parseISO(effectiveEndedAt), 'EEE, MMM d')}
                      </p>
                    </div>
                  )}
                  {visit.service_types && visit.service_types.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                        Services
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {visit.service_types.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[10px] status-completed border-transparent"
                          >
                            {SERVICE_TYPE_LABELS[t] ?? t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {visit.completion_note && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                        Note
                      </p>
                      <p className="text-sm text-foreground">{visit.completion_note}</p>
                    </div>
                  )}
                </div>
              )}
            </form>
          </Form>

          <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-row gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1 sm:flex-none">
                Cancel
              </Button>
            </SheetClose>
            {canEdit && (
              <Button
                type="submit"
                form="visit-detail-form"
                disabled={form.formState.isSubmitting}
                className="flex-1 sm:flex-none"
              >
                {form.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
