'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
import { addManualSession } from '@/app/management/schedule/session-actions'
import { useSessions } from '@/components/management/SessionsProvider'
import { activeSessionsFor, allSessionsFor, formatElapsed, formatDuration } from '@/lib/utils/visits'
import { visitUpdateSchema, type VisitUpdateValues } from '@/lib/validators/visit'
import type { Employee, ScheduleZoneRow, Vehicle, VisitSession, VisitSessionWithEmployee, VisitStatus } from '@/types/app'

const VISIT_STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'skipped', 'invoiced']

// ─── Sessions sub-components ──────────────────────────────────────────────────

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

interface SessionsSectionProps {
  visitId: string
  activeSessions: VisitSessionWithEmployee[]
  allSessions: VisitSessionWithEmployee[]
  employees: Employee[]
  canEdit: boolean
}

function SessionsSection({
  visitId,
  activeSessions,
  allSessions,
  employees,
  canEdit,
}: SessionsSectionProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [empId, setEmpId] = useState(employees[0]?.id ?? '')
  const [startedAt, setStartedAt] = useState('')
  const [endedAt, setEndedAt] = useState('')
  const [, startTransition] = useTransition()

  function handleAdd() {
    if (!startedAt) return
    const startISO = new Date(startedAt).toISOString()
    const endISO = endedAt ? new Date(endedAt).toISOString() : undefined
    startTransition(async () => {
      const res = await addManualSession(visitId, empId, startISO, endISO)
      if (res.error) {
        toast.error('Failed to add session', { description: res.error })
        return
      }
      toast.success('Session added')
      setAddOpen(false)
      setStartedAt('')
      setEndedAt('')
    })
  }

  if (activeSessions.length === 0 && allSessions.length === 0 && !canEdit) return null

  return (
    <div className="space-y-3">
      {/* On site now */}
      {activeSessions.length > 0 && (
        <div className="rounded-lg bg-[var(--clay)]/[0.08] border border-[var(--clay)]/30 px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
            <span className="text-sm font-semibold text-[var(--clay)]">On site now</span>
          </div>
          {activeSessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{s.employee?.name ?? 'Unknown'}</span>
              <ElapsedTime startedAt={s.started_at} />
            </div>
          ))}
        </div>
      )}

      {/* Session history */}
      {allSessions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Session history
          </p>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {allSessions.map((s) => (
              <div key={s.id} className="px-3 py-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {s.employee?.name?.split(' ')[0] ?? '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {format(parseISO(s.started_at), 'MMM d · h:mm a')}
                    {' → '}
                    {s.ended_at
                      ? format(parseISO(s.ended_at), 'h:mm a')
                      : 'open'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.ended_at && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatDuration(s.started_at, s.ended_at)}
                    </span>
                  )}
                  {s.source === 'manual' && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-transparent bg-muted text-muted-foreground py-0 h-auto"
                    >
                      manual
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual add */}
      {canEdit && (
        <div>
          {!addOpen ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add session manually
            </button>
          ) : (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Add session
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Crew member</label>
                  <select
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Start time <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    End time <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endedAt}
                    onChange={(e) => setEndedAt(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!startedAt || !empId}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddOpen(false)
                    setStartedAt('')
                    setEndedAt('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

interface VisitDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: ScheduleZoneRow
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

  const sessions = useSessions()
  const visitSessions = visit ? allSessionsFor(visit.id, sessions) : []
  const activeSessions = visit ? activeSessionsFor(visit.id, sessions) : []

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

  return (
    <>
      <Dialog open={skipDialogOpen} onOpenChange={(o) => { if (!o) handleSkipCancel() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip this visit?</DialogTitle>
            <DialogDescription>
              {row.zone.name} · Week of {format(parseISO(weekStart), 'MMM d')}
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
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-lg leading-tight">{row.zone.name}</SheetTitle>
            <SheetDescription>
              {row.property.address} · Week of {format(parseISO(weekStart), 'MMM d')}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              id="visit-detail-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
            >
              {/* On site now + session history */}
              {(visitSessions.length > 0 || canEdit) && (
                <SessionsSection
                  visitId={visit.id}
                  activeSessions={activeSessions}
                  allSessions={visitSessions}
                  employees={employees}
                  canEdit={canEdit}
                />
              )}

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
              {/* TODO (task 4.3): mirror this as an orange banner on app/crew/stop/[visitId]/page.tsx */}
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
                  {visit.actual_date && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                        Date completed
                      </p>
                      <p className="text-sm text-foreground">
                        {format(parseISO(visit.actual_date), 'EEE, MMM d')}
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
