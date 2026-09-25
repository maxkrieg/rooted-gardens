import { z } from 'zod'

/** `amount` is a number; the dialog converts the input string first. */
export const createContractInvoiceSchema = z
  .object({
    periodLabel: z.string().trim().min(1, 'Required'),
    periodStart: z.string().min(1, 'Required'),
    periodEnd: z.string().min(1, 'Required'),
    amount: z.number().positive('Must be greater than 0'),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'End date must be on or after the start date',
    path: ['periodEnd'],
  })

export type CreateContractInvoiceValues = z.infer<typeof createContractInvoiceSchema>
