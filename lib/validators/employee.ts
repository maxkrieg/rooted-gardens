import { z } from 'zod'
import { EMPLOYEE_ROLES, SERVICE_SIDES } from '@/types/app'

/** Team page employee form, shared by EmployeeForm and the create/update actions. */
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
 * Crew self-service profile: phone and SMS opt-in only. `smsOptIn` is stored inverted as
 * sms_opt_out.
 */
export const crewProfileSchema = z.object({
  phone: z.string().trim().optional(),
  smsOptIn: z.boolean(),
})

export type CrewProfileValues = z.infer<typeof crewProfileSchema>
