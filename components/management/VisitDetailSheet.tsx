'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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
import { PropertyVisitHistory } from '@/components/PropertyVisitHistory'
import { cn } from '@/lib/utils'
import { FilePen } from 'lucide-react'
import { saveVisitChanges, skipVisit, setVisitInvoiced } from '@/app/management/schedule/actions'
import { useVisitTimings } from '@/components/management/SessionsProvider'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { visitUpdateSchema, type VisitUpdateValues } from '@/lib/validators/visit'
import { CompletionSummary } from '@/components/crew/CompletionSummary'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { createClient } from '@/lib/supabase/client'
import type { Employee, SchedulePropertyRow, Vehicle, VisitStatus } from '@/types/app'

const VISIT_STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'skipped']

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
  const router = useRouter()

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

  // Local mirror of invoiced_at: `visit` is a snapshot from the parent's `row` prop,
  // which doesn't get refreshed while this sheet stays open after a mutation (unlike
  // the other actions in this file, which close the sheet on success). Track it
  // locally so the checkbox reflects the just-saved value immediately, and re-sync
  // whenever the sheet is opened for a (possibly different) visit.
  const [invoicedAt, setInvoicedAt] = useState<string | null>(visit?.invoiced_at ?? null)
  useEffect(() => {
    setInvoicedAt(visit?.invoiced_at ?? null)
  }, [visit])

  // Merge live realtime timing overlay with the server-fetched visit data
  const visitTimings = useVisitTimings()
  const timingOverride = visit ? visitTimings.get(visit.id) : undefined
  const effectiveStartedAt =
    timingOverride !== undefined ? timingOverride.started_at : (visit?.started_at ?? null)
  const effectiveEndedAt =
    timingOverride !== undefined ? timingOverride.ended_at : (visit?.ended_at ?? null)
  const inProgress = isVisitInProgress({ started_at: effectiveStartedAt, ended_at: effectiveEndedAt })

  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [previousStatus, setPreviousStatus] = useState<VisitStatus>('scheduled')
  const [, startTransition] = useTransition()
  const [invoicePending, startInvoiceTransition] = useTransition()

  // "Edit completion" — reuses the exact same forms crew use
  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipEditOpen, setSkipEditOpen] = useState(false)
  const { data: currentEmployee } = useCurrentEmployee()

  const isFinal =
    !!visit && (visit.status === 'completed' || visit.status === 'skipped')

  const assignedCrew = visit
    ? visit.visit_crew
        .filter((vc) => vc.relation === 'assigned' && vc.employee)
        .map((vc) => ({ employee_id: vc.employee_id, name: vc.employee!.name }))
    : []
  const completedByCrew = visit
    ? visit.visit_crew
        .filter((vc) => vc.relation === 'completed' && vc.employee)
        .map((vc) => ({ employee_id: vc.employee_id, name: vc.employee!.name }))
    : []

  // Photos for the completion details card — only fetched once the visit is final
  const { data: photos = [] } = useQuery({
    queryKey: ['visit-photos', visit?.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path, type, created_at, caption')
        .eq('visit_id', visit!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: open && !!visit && isFinal,
  })
  const photoStoragePaths = photos.map((p) => p.storage_path)
  const { data: signedPhotoUrls } = useQuery({
    queryKey: ['photo-urls', photoStoragePaths],
    queryFn: async () => {
      const supabase = createClient()
      return Promise.all(
        photoStoragePaths.map((path) =>
          supabase.storage
            .from('photos')
            .createSignedUrl(path, 3600)
            .then((r) => r.data?.signedUrl ?? null)
        )
      )
    },
    enabled: photoStoragePaths.length > 0,
    staleTime: 50 * 60 * 1000, // 50 min — well under the 1-hr signed URL expiry
  })

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

  function handleToggleInvoiced(checked: boolean) {
    if (!visit) return
    startInvoiceTransition(async () => {
      const res = await setVisitInvoiced(visit.id, checked)
      if (res.error) {
        toast.error('Failed to update invoiced status', { description: res.error })
        return
      }
      setInvoicedAt(checked ? new Date().toISOString() : null)
      toast.success(checked ? 'Marked invoiced' : 'Marked not invoiced')
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

  function handleCompletionEditSuccess() {
    router.refresh()
    onOpenChange(false)
  }

  if (!visit) return null

  const crewEmployees = employees.filter((emp) => emp.role === 'crew')

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

                    {/* Live on-site indicator — only relevant pre-completion, since a
                        final-status visit always has ended_at set */}
                    {inProgress && effectiveStartedAt && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="w-2 h-2 rounded-full bg-[var(--clay)] animate-pulse shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--clay)]">
                          On site
                        </span>
                        <ElapsedTime startedAt={effectiveStartedAt} />
                        {assignedCrew.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {assignedCrew.map((e) => e.name.split(' ')[0]).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </FormItem>
                )}
              />

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
                          disabled={!canEdit || isFinal}
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
                              disabled={!canEdit || isFinal}
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
                      disabled={!canEdit || isFinal}
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

              {/* Completion details — same summary crew see on their stop page,
                  with an Edit affordance that opens the same completion/skip forms */}
              {isFinal && (
                <div className="space-y-3">
                  <CompletionSummary
                    visit={{
                      id: visit.id,
                      status: visit.status,
                      crew_instruction: visit.crew_instruction,
                      week_start: visit.week_start,
                      started_at: effectiveStartedAt,
                      ended_at: effectiveEndedAt,
                      service_types: visit.service_types,
                      completion_note: visit.completion_note,
                      skip_reason: visit.skip_reason,
                    }}
                    completedBy={completedByCrew}
                    assignedCrew={assignedCrew}
                    canEdit={canEdit}
                    onEdit={() => setCompletionOpen(true)}
                    onEditSkip={() => setSkipEditOpen(true)}
                  />

                  {/* Invoiced — a manual stand-in until the real QuickBooks push (task
                      5.x) exists. Derived flag on invoiced_at, never a status value —
                      same convention as the in-progress state. */}
                  {visit.status === 'completed' && (
                    <label
                      className={cn(
                        'flex items-center gap-3 rounded-lg border border-border px-3 py-2.5',
                        invoicePending && 'opacity-60',
                        canEdit ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <Checkbox
                        checked={!!invoicedAt}
                        disabled={!canEdit || invoicePending}
                        onCheckedChange={(c) => handleToggleInvoiced(!!c)}
                      />
                      <span className="text-sm font-medium text-foreground flex-1 select-none">
                        Invoiced
                      </span>
                      {invoicedAt && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {format(parseISO(invoicedAt), 'MMM d')}
                        </span>
                      )}
                    </label>
                  )}

                  {photos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                        Photos
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {photos.map((photo, i) => {
                          const url = signedPhotoUrls?.[i]
                          return url ? (
                            <a key={photo.id} href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt={photo.caption ?? `Visit photo ${i + 1}`}
                                className="h-20 w-20 rounded-xl object-cover border border-border"
                              />
                            </a>
                          ) : (
                            <div key={photo.id} className="h-20 w-20 rounded-xl bg-muted animate-pulse" />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <PropertyVisitHistory propertyId={row.property.id} beforeWeekStart={visit.week_start} />
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

      <VisitLogger
        visitId={visit.id}
        employeeId={currentEmployee?.id ?? ''}
        propertyId={row.property.id}
        assignedCrew={assignedCrew}
        startedAt={effectiveStartedAt}
        initialServiceTypes={visit.service_types ?? undefined}
        initialCompletionNote={visit.completion_note ?? undefined}
        initialPresentIds={completedByCrew.length > 0 ? completedByCrew.map((c) => c.employee_id) : undefined}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={handleCompletionEditSuccess}
      />

      <SkipSheet
        visitId={visit.id}
        employeeId={currentEmployee?.id ?? ''}
        inProgress={inProgress}
        initialSkipReason={visit.skip_reason ?? undefined}
        open={skipEditOpen}
        onOpenChange={setSkipEditOpen}
        onSuccess={handleCompletionEditSuccess}
      />
    </>
  )
}
