'use client'

import { useEffect } from 'react'
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
import { saveVisitChanges } from '@/app/management/schedule/actions'
import { visitUpdateSchema, type VisitUpdateValues } from '@/lib/validators/visit'
import type { Employee, ScheduleZoneRow, Vehicle, VisitStatus } from '@/types/app'

const VISIT_STATUS_OPTIONS: VisitStatus[] = ['scheduled', 'completed', 'skipped', 'invoiced']

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
            {/* Crew Instruction — top of form; highlighted when content exists */}
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

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select disabled={!canEdit} value={field.value} onValueChange={field.onChange}>
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
  )
}
