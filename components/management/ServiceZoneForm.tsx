'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createServiceZone, updateServiceZone } from '@/app/management/accounts/property-actions'
import { serviceZoneFormSchema, type ServiceZoneFormValues } from '@/lib/validators/serviceZone'
import type { ServiceZone } from '@/types/app'

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  as_needed: 'As Needed',
}

interface ServiceZoneFormProps {
  propertyId: string
  accountId: string
  onSuccess: () => void
  /** Provide to edit an existing zone. Omit for create. */
  zone?: ServiceZone
}

export function ServiceZoneForm({
  propertyId,
  accountId,
  onSuccess,
  zone,
}: ServiceZoneFormProps) {
  const isEdit = Boolean(zone)

  const form = useForm<ServiceZoneFormValues>({
    resolver: zodResolver(serviceZoneFormSchema),
    defaultValues: zone
      ? {
          name: zone.name,
          frequency: zone.frequency as ServiceZoneFormValues['frequency'],
          notes: zone.notes ?? '',
        }
      : {
          name: '',
          frequency: 'weekly' as const,
          notes: '',
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: ServiceZoneFormValues) {
    const res = isEdit && zone
      ? await updateServiceZone(zone.id, accountId, values)
      : await createServiceZone(propertyId, accountId, values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update zone' : 'Could not add zone', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Zone updated' : 'Zone added')
    if (!isEdit) form.reset()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zone name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Front Lawn, Pool House, Steep Hill"
                  className="h-11 text-base"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service frequency <span className="text-destructive">*</span></FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zone notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Specific instructions for this zone…"
                  className="min-h-[72px] text-base resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 font-semibold"
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save zone' : 'Add zone'}
        </Button>
      </form>
    </Form>
  )
}
