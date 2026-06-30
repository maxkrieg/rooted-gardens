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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createProperty, updateProperty } from '@/app/management/accounts/property-actions'
import { propertyFormSchema, type PropertyFormValues } from '@/lib/validators/property'
import type { Property } from '@/types/app'

const FREQUENCY_LABELS: Record<PropertyFormValues['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  as_needed: 'As Needed',
}

interface PropertyFormProps {
  accountId: string
  onSuccess: () => void
  /** Prefill for edit mode. Omit for create mode. */
  property?: Property
}

export function PropertyForm({ accountId, onSuccess, property }: PropertyFormProps) {
  const isEdit = Boolean(property)

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property
      ? {
          address: property.address,
          frequency: property.frequency as PropertyFormValues['frequency'],
          parking_notes: property.parking_notes ?? '',
          access_notes: property.access_notes ?? '',
          crew_notes: property.crew_notes ?? '',
        }
      : {
          address: '',
          frequency: 'weekly',
          parking_notes: '',
          access_notes: '',
          crew_notes: '',
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: PropertyFormValues) {
    const res = isEdit && property
      ? await updateProperty(property.id, accountId, values)
      : await createProperty(accountId, values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update property' : 'Could not create property', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Property updated' : 'Property added')
    if (!isEdit) form.reset()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  placeholder="123 Maple St, Norwich VT"
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
              <FormLabel>Frequency <span className="text-destructive">*</span></FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="crew_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Crew notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Standing instructions for all visits at this property…"
                  className="min-h-[72px] text-base resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="access_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Gate code, key location, lock box…"
                  className="min-h-[60px] text-base resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parking_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parking notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Where to park the truck and trailer…"
                  className="min-h-[60px] text-base resize-none"
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
          {isSubmitting ? 'Saving…' : isEdit ? 'Save property' : 'Add property'}
        </Button>
      </form>
    </Form>
  )
}
