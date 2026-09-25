/**
 * Path and validation for the private `resumes` bucket. Uploads happen server-side only;
 * validateResumeFile also runs client-side for a fast reject.
 */
const MAX_RESUME_BYTES = 4 * 1024 * 1024
const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/** Mirrors the `resumes` bucket's allowed_mime_types (migration
 *  20260806130000). */
function extensionForResumeMime(mime: string): 'pdf' | 'doc' | 'docx' {
  if (mime === 'application/msword') return 'doc'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'pdf'
}

/**
 * Flat UUID path: the lead row doesn't exist yet at upload time, and there's no UPDATE policy
 * to survive a collision.
 */
export function resumePath(mimeType: string): string {
  return `resumes/${crypto.randomUUID()}.${extensionForResumeMime(mimeType)}`
}

/** Returns a human-readable reason the file can't be uploaded, or null if it's fine. */
export function validateResumeFile(file: File): string | null {
  if (file.size > MAX_RESUME_BYTES) return 'too large (max 4 MB)'
  if (!ALLOWED_RESUME_TYPES.includes(file.type)) return 'unsupported format (use PDF or Word)'
  return null
}
