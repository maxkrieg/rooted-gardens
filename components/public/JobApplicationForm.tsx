'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CheckCircle2, FileText, Leaf, Paperclip } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useEditMode } from '@/components/public/editing/EditModeProvider'
import { useElapsedMs } from '@/hooks/useElapsedMs'
import { submitJobApplication } from '@/app/(public)/jobs/actions'
import { jobApplicationFormSchema, type JobApplicationFormValues } from '@/lib/validators/lead'
import { validateResumeFile } from '@/lib/utils/resumes'

interface JobApplicationFormProps {
  /** Prefilled from the job title an "Apply" button was clicked from
   *  (`/jobs?position=...#apply`) — still a plain editable field, since
   *  open positions are a dynamic, owner-edited list and a visitor should
   *  be able to apply generally with no specific opening in mind. */
  initialPosition?: string
}

/**
 * The public job application form (task 9.6) — reachable at `/jobs`
 * (id="apply" so each listing's "Apply" button can deep-link to `#apply`).
 * Submits through `submitJobApplication` (app/(public)/jobs/actions.ts),
 * the second consumer — after InquiryForm/submitInquiry (9.5) — of the
 * spam-protected public-lead pattern: a hidden honeypot field, a minimum-
 * time-on-form check (`useElapsedMs`), and a per-IP rate limit, all
 * re-checked server-side since a bypassed client proves nothing.
 *
 * Submits as `FormData`, not a typed object like `submitInquiry` — that's
 * the well-supported way to carry the optional resume `File` alongside the
 * text fields through a Server Action.
 */
export function JobApplicationForm({ initialPosition }: JobApplicationFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const elapsedMs = useElapsedMs()
  const { editing } = useEditMode()

  const form = useForm<JobApplicationFormValues>({
    resolver: zodResolver(jobApplicationFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      position: initialPosition ?? '',
      message: '',
      website: '',
      elapsedMs: 0,
    },
  })

  const isSubmitting = form.formState.isSubmitting

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be picked again

    if (!file) return

    const rejection = validateResumeFile(file)
    if (rejection) {
      toast.error(`Could not attach ${file.name}`, { description: rejection })
      return
    }

    setResumeFile(file)
  }

  async function onSubmit(values: JobApplicationFormValues) {
    const formData = new FormData()
    formData.set('name', values.name)
    formData.set('email', values.email ?? '')
    formData.set('phone', values.phone ?? '')
    formData.set('position', values.position)
    formData.set('message', values.message ?? '')
    formData.set('website', values.website)
    formData.set('elapsedMs', String(elapsedMs))
    if (resumeFile) formData.set('resume', resumeFile)

    const res = await submitJobApplication(formData)

    if (res.error) {
      toast.error('Could not send your application', { description: res.error })
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        id="apply"
        className="rounded-2xl border border-border bg-card shadow-warm p-6 sm:p-8 text-center"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
          Thanks — we&apos;ve got your application
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Someone from our team will follow up if it looks like a fit. We appreciate you thinking
          of us.
        </p>
      </div>
    )
  }

  return (
    <div id="apply" className="rounded-2xl border border-border bg-card shadow-warm p-5 sm:p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Honeypot — off-screen, not display:none (some bots skip hidden
              fields), unreachable by tab order, unread by screen readers.
              A real visitor never sees or fills this. */}
          <div className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
            <label htmlFor="job-website">Leave this field blank</label>
            <input
              id="job-website"
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
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Position <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="What role are you interested in?" className="h-11 text-base" {...field} />
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
                    placeholder="Tell us a bit about yourself…"
                    className="min-h-[120px] text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Resume</label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                {resumeFile ? 'Change file' : 'Attach resume'}
              </Button>
              {resumeFile && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{resumeFile.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PDF or Word, up to 4 MB. Optional.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          <Button type="submit" disabled={isSubmitting || editing} className="w-full h-12 font-semibold">
            {isSubmitting ? 'Sending…' : 'Send application'}
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
