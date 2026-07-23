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
import { createVehicle, updateVehicle } from '@/app/management/fleet/actions'
import { vehicleFormSchema, type VehicleFormValues } from '@/lib/validators/fleet'
import { VEHICLE_STATUSES, VEHICLE_TYPES, type Vehicle } from '@/types/app'
import { VEHICLE_STATUS_LABELS, VEHICLE_TYPE_LABELS } from '@/lib/utils/fleet'

interface VehicleFormProps {
  onSuccess: () => void
  vehicle?: Vehicle
}

export function VehicleForm({ onSuccess, vehicle }: VehicleFormProps) {
  const isEdit = Boolean(vehicle)

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicle
      ? {
          name: vehicle.name,
          type: (VEHICLE_TYPES.includes(vehicle.type as (typeof VEHICLE_TYPES)[number])
            ? vehicle.type
            : 'other') as VehicleFormValues['type'],
          plate: vehicle.plate ?? '',
          status: vehicle.status as VehicleFormValues['status'],
          notes: vehicle.notes ?? '',
        }
      : {
          name: '',
          type: 'truck' as const,
          plate: '',
          status: 'available' as const,
          notes: '',
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: VehicleFormValues) {
    const res = isEdit && vehicle
      ? await updateVehicle(vehicle.id, values)
      : await createVehicle(values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update vehicle' : 'Could not create vehicle', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created')
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
                <Input placeholder="e.g. Blue F-150" className="h-11 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plate</FormLabel>
                <FormControl>
                  <Input placeholder="ABC-1234" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VEHICLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</SelectItem>
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
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional details…"
                  className="min-h-[80px] text-base resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-semibold">
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create vehicle'}
        </Button>
      </form>
    </Form>
  )
}
