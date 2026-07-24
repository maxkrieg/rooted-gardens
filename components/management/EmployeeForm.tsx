'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createEmployee, updateEmployee } from '@/app/management/team/actions'
import { employeeFormSchema, type EmployeeFormValues } from '@/lib/validators/employee'
import { EMPLOYEE_ROLES, SERVICE_SIDES, type Employee } from '@/types/app'
import { EMPLOYEE_ROLE_LABELS, SERVICE_SIDE_LABELS } from '@/lib/utils/team'

interface EmployeeFormProps {
  onSuccess: () => void
  employee?: Employee
}

export function EmployeeForm({ onSuccess, employee }: EmployeeFormProps) {
  const isEdit = Boolean(employee)

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee
      ? {
          name: employee.name,
          email: employee.email ?? '',
          phone: employee.phone ?? '',
          role: (EMPLOYEE_ROLES.includes(employee.role as (typeof EMPLOYEE_ROLES)[number])
            ? employee.role
            : 'crew') as EmployeeFormValues['role'],
          side: (SERVICE_SIDES.includes(employee.side as (typeof SERVICE_SIDES)[number])
            ? employee.side
            : 'both') as EmployeeFormValues['side'],
          active: employee.active,
          hourly_rate: employee.hourly_rate ?? undefined,
        }
      : {
          name: '',
          email: '',
          phone: '',
          role: 'crew' as const,
          side: 'both' as const,
          active: true,
          hourly_rate: undefined,
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: EmployeeFormValues) {
    const res = isEdit && employee
      ? await updateEmployee(employee.id, values)
      : await createEmployee(values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update employee' : 'Could not create employee', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Employee updated' : 'Employee added')
    if (!isEdit) form.reset()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 overflow-y-auto pr-1">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Sarah Chen" className="h-11 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{EMPLOYEE_ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="side"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Side</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SERVICE_SIDES.map((s) => (
                      <SelectItem key={s} value={s}>{SERVICE_SIDE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    className="h-11 text-base"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Required to invite them to the app.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="(802) 555-0100" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="hourly_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hourly rate</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 24.00"
                  className="h-11 text-base"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                  }
                />
              </FormControl>
              <FormDescription>Optional — pay reference only.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <FormLabel>Active</FormLabel>
                <FormDescription>Inactive employees are hidden from scheduling.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-semibold">
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
        </Button>
      </form>
    </Form>
  )
}
