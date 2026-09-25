import { z } from 'zod'
import { BILLING_TYPES, ACCOUNT_STATUSES, CONTRACT_PERIODS } from '@/types/app'

/**
 * Account form schema, shared by AccountForm and the actions. The form converts empty numeric
 * inputs to undefined, so there's no z.preprocess.
 */
export const accountFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    contact_name: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || z.email().safeParse(v).success, {
        message: 'Invalid email address',
      }),
    phone: z.string().trim().optional(),
    // Structured billing/mailing address — for QuickBooks invoices, separate from
    // properties.address (the serviced location). Each part is independently optional.
    billing_address_line1: z.string().trim().optional(),
    billing_address_line2: z.string().trim().optional(),
    billing_city: z.string().trim().optional(),
    billing_state: z.string().trim().optional(),
    billing_zip: z.string().trim().optional(),
    billing_type: z.enum(BILLING_TYPES),
    // Numbers only — the form converts '' → undefined on input change
    price_per_visit: z.number().positive('Must be a positive amount').optional(),
    contract_rate: z.number().positive('Must be a positive amount').optional(),
    contract_period: z.enum(CONTRACT_PERIODS).optional(),
    // status always has a value (Select defaults to 'active' via defaultValues)
    status: z.enum(ACCOUNT_STATUSES),
    notes: z.string().trim().optional(),
    // Normally set by the QBO sync, but editable here.
    qbo_customer_id: z.string().trim().optional(),
  })
  // Conditional requirements based on billing type
  .refine(
    (d) => d.billing_type !== 'per_visit' || d.price_per_visit != null,
    { path: ['price_per_visit'], message: 'Price per visit is required' },
  )
  .refine(
    (d) => d.billing_type !== 'contract' || d.contract_rate != null,
    { path: ['contract_rate'], message: 'Contract rate is required' },
  )
  .refine(
    (d) => d.billing_type !== 'contract' || d.contract_period != null,
    { path: ['contract_period'], message: 'Contract period is required' },
  )

export type AccountFormValues = z.infer<typeof accountFormSchema>
