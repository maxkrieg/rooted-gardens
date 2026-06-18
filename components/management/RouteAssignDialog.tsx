'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { bulkAssignRoute } from '@/app/management/schedule/actions'
import { routeAssignSchema, type RouteAssignValues } from '@/lib/validators/visit'
import type { Employee, RouteGroup, ScheduleWeek, Vehicle } from '@/types/app'

interface RouteAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routeGroup: RouteGroup
  weeks: ScheduleWeek[]
  employees: Employee[]
  vehicles: Vehicle[]
}

export function RouteAssignDialog({
  open,
  onOpenChange,
  routeGroup,
  weeks,
  employees,
  vehicles,
}: RouteAssignDialogProps) {
  const crewEmployees = employees.filter((e) => e.role === 'crew')

  const form = useForm<RouteAssignValues>({
    resolver: zodResolver(routeAssignSchema),
    defaultValues: {
      week_start: weeks[0]?.weekStart ?? '',
      employee_ids: [],
      vehicle_id: null,
    },
  })

  async function onSubmit(values: RouteAssignValues) {
    const res = await bulkAssignRoute(
      routeGroup.id,
      values.week_start,
      values.employee_ids,
      values.vehicle_id ?? null,
    )
    if (res.error) {
      toast.error('Failed to assign route', { description: res.error })
      return
    }
    const count = res.count ?? 0
    toast.success(count === 0 ? 'No scheduled visits found for that week' : `Assigned ${count} visit${count === 1 ? '' : 's'}`)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Assign Route · {routeGroup.name}
          </DialogTitle>
          <DialogDescription>
            Apply crew and vehicle to all scheduled visits in this route for the selected week.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="route-assign-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 py-1"
          >
            {/* Week */}
            <FormField
              control={form.control}
              name="week_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Week</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {weeks.map((w) => (
                        <SelectItem key={w.weekStart} value={w.weekStart}>
                          Week of {format(parseISO(w.weekStart), 'MMM d')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Crew */}
            <FormField
              control={form.control}
              name="employee_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crew</FormLabel>
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
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { form.reset(); onOpenChange(false) }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="route-assign-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
