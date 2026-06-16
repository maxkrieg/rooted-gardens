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
import { createRouteGroup, updateRouteGroup } from '@/app/management/route-groups/actions'
import { routeGroupFormSchema, type RouteGroupFormValues } from '@/lib/validators/routeGroup'
import type { RouteGroup } from '@/types/app'

interface RouteGroupFormProps {
  onSuccess: () => void
  routeGroup?: RouteGroup
}

export function RouteGroupForm({ onSuccess, routeGroup }: RouteGroupFormProps) {
  const isEdit = Boolean(routeGroup)

  const form = useForm<RouteGroupFormValues>({
    resolver: zodResolver(routeGroupFormSchema),
    defaultValues: routeGroup
      ? { name: routeGroup.name }
      : { name: '' },
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: RouteGroupFormValues) {
    const res = isEdit && routeGroup
      ? await updateRouteGroup(routeGroup.id, values)
      : await createRouteGroup(values)

    if (res.error) {
      toast.error(isEdit ? 'Could not update route group' : 'Could not create route group', {
        description: res.error,
      })
      return
    }

    toast.success(isEdit ? 'Route group updated' : 'Route group created')
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
              <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Sharon VT, Hawk Pine Rd Corridor"
                  className="h-11 text-base"
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
          {isSubmitting ? 'Saving…' : isEdit ? 'Save route group' : 'Create route group'}
        </Button>
      </form>
    </Form>
  )
}
