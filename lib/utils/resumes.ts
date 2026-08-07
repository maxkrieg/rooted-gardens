/**
 * Path + validation helpers for the private `resumes` Storage bucket (task
 * 9.6), mirroring `lib/utils/photos.ts` / `lib/utils/site-media.ts`. Unlike
 * those buckets, resumes are uploaded server-side only (see
 * app/(public)/jobs/actions.ts) — the upload always runs inside the
 * `submitJobApplication` Server Action via the service-role client, never
 * directly from the browser, so this module has no client-vs-server
 * isomorphism constraint to worry about. `validateResumeFile` is still used
 * client-side too, though, for an immediate reject on an obviously-bad pick
 * before the file ever leaves the browser — the server-side check inside
 * the Server Action is the real backstop.
 */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024
export const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/** Mirrors the `resumes` bucket's allowed_mime_types (migration
 *  20260806130000). */
export function extensionForResumeMime(mime: string): 'pdf' | 'doc' | 'docx' {
  if (mime === 'application/msword') return 'doc'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'pdf'
}

/** Flat (no entity id to scope by): a resume is uploaded before the `leads`
 *  row it'll be attached to exists, and the bucket is private and never
 *  browsed by prefix — unlike `propertyPhotoPath`, there's nothing to group
 *  by here. UUID filename, same collision-avoidance rationale as
 *  photos/site-media (no storage UPDATE policy, so a collision would be a
 *  hard 403, not an overwrite). */
export function resumePath(mimeType: string): string {
  return `resumes/${crypto.randomUUID()}.${extensionForResumeMime(mimeType)}`
}

/** Returns a human-readable reason the file can't be uploaded, or null if it's fine. */
export function validateResumeFile(file: File): string | null {
  if (file.size > MAX_RESUME_BYTES) return 'too large (max 4 MB)'
  if (!ALLOWED_RESUME_TYPES.includes(file.type)) return 'unsupported format (use PDF or Word)'
  return null
}
