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

/**
 * Crew self-service profile edit (crew /profile). Deliberately tiny — crew may
 * only change their own phone and SMS opt-in. Email is read-only here (login-email
 * changes are owner-managed) and role/side/active/hourly_rate are never editable
 * by the employee. `smsOptIn` is opt-*in*; the DB column is opt-*out* (stored
 * inverted by the action).
 */
export const crewProfileSchema = z.object({
  phone: z.string().trim().optional(),
  smsOptIn: z.boolean(),
})

export type CrewProfileValues = z.infer<typeof crewProfileSchema>
