'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CheckCircle2, Leaf } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useEditMode } from '@/components/public/editing/EditModeProvider'
import { submitInquiry } from '@/app/(public)/contact/actions'
import { inquiryFormSchema, LEAD_SERVICE_INTEREST_LABELS, type InquiryFormValues } from '@/lib/validators/lead'
import { SERVICE_SIDES } from '@/types/app'

const SERVICE_OPTIONS = SERVICE_SIDES.map((value) => ({
  value,
  label: LEAD_SERVICE_INTEREST_LABELS[value],
}))

const DEFAULT_VALUES: InquiryFormValues = {
  name: '',
  email: '',
  phone: '',
  address: '',
  service_interest: 'lawn',
  message: '',
  website: '',
  elapsedMs: 0,
}

/** How often `elapsedMs` advances while the form is open — mirrors the
 *  `setTick` interval pattern in ScheduleGrid/CrewsOnSitePanel. Coarse on
 *  purpose: `submitInquiry`'s timing check only cares whether the form was
 *  open for at least a couple seconds, not to the millisecond, so ticking a
 *  plain counter (no `Date.now()` call in the render path) is both simpler
 *  and satisfies the "no impure calls during render" rule. */
const ELAPSED_TICK_MS = 500

/**
 * The public inquiry form (task 9.5) — reachable at `/contact` (id="inquiry"
 * so the home CTA can deep-link to `#inquiry`). Submits through the
 * `submitInquiry` Server Action, which is deliberately unauthenticated
 * (app/(public)/contact/actions.ts) and carries its own spam protection
 * (lib/leads/spam.ts): a hidden honeypot field plus a minimum-time-on-form
 * check, both re-checked server-side since a bypassed client proves nothing.
 */
export function InquiryForm() {
  const [submitted, setSubmitted] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const { editing } = useEditMode()

  useEffect(() => {
    const id = setInterval(() => setElapsedMs((ms) => ms + ELAPSED_TICK_MS), ELAPSED_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const isSubmitting = form.formState.isSubmitting

  async function onSubmit(values: InquiryFormValues) {
    const res = await submitInquiry({ ...values, elapsedMs })

    if (res.error) {
      toast.error('Could not send your message', { description: res.error })
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        id="inquiry"
        className="rounded-2xl border border-border bg-card shadow-warm p-6 sm:p-8 text-center"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
          Thanks — we&apos;ve got it
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Someone from our team will follow up within a couple of business days. If it&apos;s
          urgent, feel free to call or email a division directly — you&apos;ll find those below.
        </p>
      </div>
    )
  }

  return (
    <div id="inquiry" className="rounded-2xl border border-border bg-card shadow-warm p-5 sm:p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Honeypot — off-screen, not display:none (some bots skip hidden
              fields), unreachable by tab order, unread by screen readers.
              A real visitor never sees or fills this. */}
          <div className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label htmlFor="website">Leave this field blank</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register('website')}
            />
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Your name" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" className="h-11 text-base" {...field} />
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
                    <Input type="tel" placeholder="(802) 555-0123" className="h-11 text-base" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property address</FormLabel>
                <FormControl>
                  <Input placeholder="Where's the work?" className="h-11 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="service_interest"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  What are you interested in? <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid gap-2 pt-1 sm:grid-cols-3"
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-3 cursor-pointer hover:bg-accent/40 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/60"
                      >
                        <RadioGroupItem value={opt.value} className="shrink-0" />
                        <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us a bit about what you're looking for…"
                    className="min-h-[120px] text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting || editing} className="w-full h-12 font-semibold">
            {isSubmitting ? 'Sending…' : 'Send message'}
          </Button>
          {editing && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Leaf className="h-3.5 w-3.5" />
              Editing — submissions are paused while you&apos;re editing this page.
            </p>
          )}
        </form>
      </Form>
    </div>
  )
}
