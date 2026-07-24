import { z } from 'zod'
import { EMPLOYEE_ROLES, SERVICE_SIDES } from '@/types/app'

/**
 * Zod schema for the Team page employee create/edit form (task 7.1).
 * Single source of truth — shared by EmployeeForm (client) and the
 * createEmployee / updateEmployee Server Actions to prevent drift, following
 * lib/validators/account.ts + fleet.ts: strings are .trim().optional(), the
 * numeric hourly_rate stays z.number() (the form converts '' → undefined on
 * change), enums come from types/app.
 */
export const employeeFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, {
      message: 'Invalid email address',
    }),
  phone: z.string().trim().optional(),
  role: z.enum(EMPLOYEE_ROLES),
  side: z.enum(SERVICE_SIDES),
  active: z.boolean(),
  // Pay rate — optional pay-reference only (no payroll/time tracking in the app).
  // Number only; the form converts '' → undefined on input change.
  hourly_rate: z.number().positive('Must be a positive amount').optional(),
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>
