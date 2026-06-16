'use client'

import { useForm, useWatch } from 'react-hook-form'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createAccount } from '@/app/management/accounts/actions'
import { accountFormSchema, type AccountFormValues } from '@/lib/validators/account'
import type { Account } from '@/types/app'

interface AccountFormProps {
  /** Called on successful save — used by the parent Sheet to close itself. */
  onSuccess: () => void
  /** Optional: prefill the form for edit mode (task 2.4) or lead→account (9.9). */
  account?: Account
}

export function AccountForm({ onSuccess, account: _account }: AccountFormProps) {
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      billing_type: 'per_visit' as const,
      price_per_visit: undefined,
      contract_rate: undefined,
      contract_period: undefined,
      status: 'active' as const,
      notes: '',
    },
  })

  const billingType = useWatch({ control: form.control, name: 'billing_type' })
  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: AccountFormValues) {
    const res = await createAccount(values)
    if (res.error) {
      toast.error('Could not create account', { description: res.error })
      return
    }
    toast.success('Account created')
    form.reset()
    onSuccess()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 overflow-y-auto pr-1">

        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Smith Residence" className="h-11 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contact name */}
        <FormField
          control={form.control}
          name="contact_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jane Smith" className="h-11 text-base" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email + Phone side by side on wider screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="jane@example.com"
                    className="h-11 text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="802-555-0100"
                    className="h-11 text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Billing type */}
        <FormField
          control={form.control}
          name="billing_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Billing type <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-col gap-2 pt-1"
                >
                  {[
                    { value: 'per_visit', label: 'Per Visit', description: 'One invoice per completed visit' },
                    { value: 'contract', label: 'Contract', description: 'Flat periodic rate' },
                    { value: 'as_needed', label: 'As Needed', description: 'Quoted per engagement' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/40 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/60"
                    >
                      <RadioGroupItem value={opt.value} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium leading-none">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price per visit — only for per_visit */}
        {billingType === 'per_visit' && (
          <FormField
            control={form.control}
            name="price_per_visit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per visit ($) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-11 text-base"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Contract rate + period — only for contract */}
        {billingType === 'contract' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contract_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract rate ($) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="h-11 text-base"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contract_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-11 text-base">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Status */}
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="prospective">Prospective</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
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

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 font-semibold"
        >
          {isSubmitting ? 'Saving…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
