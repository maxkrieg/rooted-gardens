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
import { createEquipment, updateEquipment } from '@/app/management/fleet/actions'
import { equipmentFormSchema, type EquipmentFormValues } from '@/lib/validators/fleet'
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type Equipment } from '@/types/app'
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_TYPE_LABELS } from '@/lib/utils/fleet'

interface EquipmentFormProps {
  onSuccess: () => void
  equipment?: Equipment
}

export function EquipmentForm({ onSuccess, equipment }: EquipmentFormProps) {
  const isEdit = Boolean(equipment)

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: equipment
      ? {
          name: equipment.name,
          type: equipment.type as EquipmentFormValues['type'],
          status: equipment.status as EquipmentFormValues['status'],
          last_serviced: equipment.last_serviced ?? '',
          notes: equipment.notes ?? '',
        }
      : {
          name: '',
          type: 'mower' as const,
          status: 'available' as const,
          last_serviced: '',
          notes: '',
        },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: EquipmentFormValues) {
    const res = isEdit && equipment
      ? await updateEquipment(equipment.id, values)
      : await createEquipment(values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update equipment' : 'Could not create equipment', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Equipment updated' : 'Equipment created')
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
                <Input placeholder="e.g. Mower #3" className="h-11 text-base" {...field} />
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
                    {EQUIPMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    {EQUIPMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="last_serviced"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Last serviced{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input type="date" className="h-11 text-base" {...field} />
              </FormControl>
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
          {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create equipment'}
        </Button>
      </form>
    </Form>
  )
}
