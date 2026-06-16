import { z } from 'zod'

export const routeGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'Route group name is required'),
})

export type RouteGroupFormValues = z.infer<typeof routeGroupFormSchema>
