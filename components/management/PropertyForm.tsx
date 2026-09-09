'use client'

import { useForm, useWatch } from 'react-hook-form'
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
import { createProperty, updateProperty } from '@/app/app/(padded)/accounts/property-actions'
import { useRefreshAccounts, useUpdatePropertyNotes } from '@/hooks/useAccounts'
import { FREQUENCY_DEFAULT_INTERVAL_DAYS } from '@/lib/utils/cadence'
import { propertyFormSchema, type PropertyFormValues } from '@/lib/validators/property'
import type { Property } from '@/types/app'

/**
 * True when the edit touches only the fields the offline queue can replay
 * safely: the three notes plus the service interval. Address and frequency
 * still need the Server Action — replaying those blindly could clobber a real
 * edit made in between.
 */
function isQueueableChange(property: Property, values: PropertyFormValues): boolean {
  return property.address === values.address.trim() && property.frequency === values.frequency
}

/** '' / undefined means "follow the frequency default" and stores as NULL. */
function parseInterval(value: string | undefined): number | null {
  return value ? Number(value) : null
}

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
  /** Create-mode prefill (lead→account, 9.9) — does NOT flip the form into
   *  edit mode the way `property` does. Merged over the plain-create defaults. */
  defaults?: Partial<PropertyFormValues>
}

export function PropertyForm({ accountId, onSuccess, property, defaults }: PropertyFormProps) {
  const isEdit = Boolean(property)

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property
      ? {
          address: property.address,
          frequency: property.frequency as PropertyFormValues['frequency'],
          preferred_interval_days: property.preferred_interval_days?.toString() ?? '',
          parking_notes: property.parking_notes ?? '',
          access_notes: property.access_notes ?? '',
          crew_notes: property.crew_notes ?? '',
        }
      : {
          address: '',
          frequency: 'weekly',
          preferred_interval_days: '',
          parking_notes: '',
          access_notes: '',
          crew_notes: '',
          ...defaults,
        },
  })

  const isSubmitting = form.formState.isSubmitting

  const updateNotes = useUpdatePropertyNotes(accountId)
  const refreshAccounts = useRefreshAccounts()

  async function onSubmit(values: PropertyFormValues) {
    // Notes and the interval go through the offline queue — those are the
    // corrections an owner makes standing at the property, often with no signal.
    if (isEdit && property && isQueueableChange(property, values)) {
      try {
        await updateNotes(
          property.id,
          {
            crewNotes: values.crew_notes?.trim() || null,
            accessNotes: values.access_notes?.trim() || null,
            parkingNotes: values.parking_notes?.trim() || null,
            preferredIntervalDays: parseInterval(values.preferred_interval_days),
          },
          property.address,
        )
        toast.success('Property updated')
        onSuccess()
      } catch {
        toast.error('Could not update property', {
          description: 'Check "Changes that didn’t save" at the top of the screen.',
        })
      }
      return
    }

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
    refreshAccounts(accountId)
    if (!isEdit) form.reset()
    onSuccess()
  }

  // useWatch, not form.watch: watch() opts the whole component out of React
  // Compiler memoization. Same pattern as AccountForm's billing-type branch.
  const selectedFrequency = useWatch({ control: form.control, name: 'frequency' })
  const defaultInterval = FREQUENCY_DEFAULT_INTERVAL_DAYS[selectedFrequency] ?? null
  const intervalPlaceholder = defaultInterval === null ? 'No overdue warning' : `${defaultInterval}`
  const intervalHelp =
    defaultInterval === null
      ? 'As-needed properties have no interval. Set a number of days to get an overdue warning anyway.'
      : `Leave blank to follow ${FREQUENCY_LABELS[selectedFrequency]} — ${defaultInterval} days.`

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
          name="preferred_interval_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service interval</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    // The placeholder is the derived default, live off the
                    // frequency field above — it's what makes "leave this blank"
                    // legible without a second control explaining it.
                    placeholder={intervalPlaceholder}
                    className="h-11 text-base pr-14"
                    {...field}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    days
                  </span>
                </div>
              </FormControl>
              <p className="text-xs text-muted-foreground">{intervalHelp}</p>
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
