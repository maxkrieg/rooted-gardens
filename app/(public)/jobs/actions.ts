'use server'

import { toUserMessage } from '@/lib/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient } from '@/lib/supabase/service'
import { checkLeadSpamSignals, enforceLeadRateLimit, getClientIp, hashIp } from '@/lib/leads/spam'
import { jobApplicationFormSchema } from '@/lib/validators/lead'
import { resumePath, validateResumeFile } from '@/lib/utils/resumes'
import type { JobApplicationDetails } from '@/types/app'

/**
 * Public, unauthenticated Server Action backing JobApplicationForm (task
 * 9.6) — the second, and last for this phase, consumer of the spam-
 * protected public-lead pattern app/(public)/contact/actions.ts (9.5)
 * established. Same shape as `submitInquiry`, but takes `FormData` rather
 * than a typed object: FormData is the well-supported way to carry an
 * optional binary `File` (the resume) alongside the text fields through a
 * Server Action, which `submitInquiry`'s all-string/number payload never
 * needed.
 */
export async function submitJobApplication(formData: FormData): Promise<{ error?: string }> {
  const parsed = jobApplicationFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    position: formData.get('position'),
    message: formData.get('message') || undefined,
    website: formData.get('website') ?? '',
    elapsedMs: Number(formData.get('elapsedMs')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }

  // Honeypot / too-fast bot signals: pretend success without writing a row
  // or uploading anything. Telling a bot it was caught just teaches it to
  // adapt; a silent no-op costs it nothing to learn from.
  const spamSignal = checkLeadSpamSignals({
    website: parsed.data.website,
    elapsedMs: parsed.data.elapsedMs,
  })
  if (spamSignal) {
    console.warn('[submitJobApplication] spam signal', spamSignal)
    return {}
  }

  const ip = await getClientIp()
  const ipHash = hashIp(ip ?? 'unknown')
  const { limited } = await enforceLeadRateLimit(ipHash, 'job_application')
  if (limited) {
    return {
      error: "We've already got a few messages from you. Give us a little time to reply, then try again.",
    }
  }

  // Resume upload, if attached — runs server-side via the service-role
  // client, never a direct browser-to-Storage write. There's no `anon`
  // Storage policy on the `resumes` bucket at all (migration
  // 20260806130000): a public applicant has no session to scope one by, so
  // an anon INSERT policy could only constrain bucket_id, letting anyone
  // upload directly via the Storage REST API and bypass the honeypot/rate-
  // limit above entirely. Routing it through this action keeps the resume
  // upload gated by the same spam checks as the rest of the application.
  let uploadedPath: string | null = null
  const resumeEntry = formData.get('resume')
  const resumeFile = resumeEntry instanceof File && resumeEntry.size > 0 ? resumeEntry : null

  if (resumeFile) {
    const rejection = validateResumeFile(resumeFile)
    if (rejection) {
      return { error: `Resume ${rejection}.` }
    }

    const serviceClient = createServiceClient()
    const path = resumePath(resumeFile.type)
    const { error: uploadError } = await serviceClient.storage.from('resumes').upload(path, resumeFile)

    if (uploadError) {
      return { error: toUserMessage(uploadError, 'Could not upload your resume.', '[submitJobApplication]') }
    }

    uploadedPath = path
  }

  const details: JobApplicationDetails = {
    position: parsed.data.position,
    resume_path: uploadedPath,
  }

  const supabase = createPublicClient()
  // No `.select()` chained — same 9.1 carry-forward as submitInquiry:
  // `anon` has INSERT but no SELECT on `leads`, so `RETURNING` fails RLS
  // even from an INSERT.
  const { error } = await supabase.from('leads').insert({
    kind: 'job_application',
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
    details,
  })

  if (error) {
    // The blob landed but the row didn't — clean it up so we don't leave an
    // object nothing references (mirrors PhotoUploadDropzone's cleanup).
    // Service-role client, so this doesn't depend on any Storage policy.
    if (uploadedPath) {
      await createServiceClient().storage.from('resumes').remove([uploadedPath])
    }
    return { error: toUserMessage(error, 'Could not send your application.', '[submitJobApplication]') }
  }

  return {}
}
