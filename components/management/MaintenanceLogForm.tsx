'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { logMaintenance } from '@/app/management/fleet/actions'
import { maintenanceLogFormSchema, type MaintenanceLogFormValues } from '@/lib/validators/fleet'

interface MaintenanceLogFormProps {
  /** Exactly one of vehicleId / equipmentId identifies the target. */
  target: { vehicleId: string } | { equipmentId: string }
  onSuccess: () => void
  onCancel: () => void
}

export function MaintenanceLogForm({ target, onSuccess, onCancel }: MaintenanceLogFormProps) {
  const form = useForm<MaintenanceLogFormValues>({
    resolver: zodResolver(maintenanceLogFormSchema),
    defaultValues: {
      service_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      next_service_due: '',
      cost: undefined,
    },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: MaintenanceLogFormValues) {
    const res = await logMaintenance(target, values)
    if (res.error) {
      toast.error('Could not log maintenance', { description: res.error })
      return
    }
    toast.success('Maintenance logged')
    form.reset()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="service_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input type="date" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="next_service_due"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Next service due{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work performed <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Oil change, new blades"
                  className="min-h-[70px] text-base resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Cost ($){' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="h-11 text-base"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={isSubmitting} className="flex-1 h-11 font-semibold">
            {isSubmitting ? 'Saving…' : 'Log maintenance'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
