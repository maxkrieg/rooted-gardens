'use server'

import { toUserMessage } from '@/lib/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient } from '@/lib/supabase/service'
import { checkLeadSpamSignals, enforceLeadRateLimit, getClientIp, hashIp } from '@/lib/leads/spam'
import { jobApplicationFormSchema } from '@/lib/validators/lead'
import { resumePath, validateResumeFile } from '@/lib/utils/resumes'
import type { JobApplicationDetails } from '@/types/app'

/** Public job application. Takes FormData to carry the optional resume File. */
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

  // Bot signals: pretend success and write nothing.
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

  // Resume uploads go through here, never browser-to-Storage: `resumes` has no anon policy, so
  // uploads stay behind the spam checks.
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
  // No `.select()`: anon can't SELECT leads, so RETURNING fails RLS.
  const { error } = await supabase.from('leads').insert({
    kind: 'job_application',
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
    details,
  })

  if (error) {
    // The row failed after the upload; remove the orphaned object.
    if (uploadedPath) {
      await createServiceClient().storage.from('resumes').remove([uploadedPath])
    }
    return { error: toUserMessage(error, 'Could not send your application.', '[submitJobApplication]') }
  }

  return {}
}
