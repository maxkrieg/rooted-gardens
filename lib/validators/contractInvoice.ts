import { z } from 'zod'

/**
 * `amount` is typed as a plain `number` — the dialog converts the input
 * string to a number (or undefined) before handing it to RHF, same
 * convention as lib/validators/account.ts's price_per_visit/contract_rate,
 * so this stays compatible with @hookform/resolvers' type inference.
 */
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
