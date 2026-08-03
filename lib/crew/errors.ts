import { toast } from 'sonner'
import { isOfflineError } from '@/lib/errors'

/**
 * Toast an error from a crew-side mutation.
 *
 * Online-only crew mutations throw `new Error('offline')` rather than attempting
 * a doomed request, and "this needs a connection" is a completely different
 * message from "this failed" for someone standing in a field in rural Vermont —
 * one means wait, the other means something is wrong.
 *
 * This logic was written out by hand in six hooks and four components (and
 * privately as `handleOfflineOrGenericError` in VisitDetailContent); it lives
 * here now so every crew surface says the same thing.
 */
export function toastCrewError(err: unknown, fallback: string) {
  if (isOfflineError(err)) {
    toast.error('This needs a connection. It’ll work once you have signal.')
    return
  }
  console.error('[crew]', err)
  toast.error(fallback)
}
