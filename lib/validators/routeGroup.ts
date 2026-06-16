import { z } from 'zod'

export const routeGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Route group name is required'),
  // sort_order controls display ordering; form converts '' → undefined like numeric fields in AccountForm
  sort_order: z.number().int().min(0).optional(),
})

export type RouteGroupFormValues = z.infer<typeof routeGroupFormSchema>
