import { toast } from 'sonner'
import { isOfflineError } from '@/lib/errors'

/**
 * Toast an error from a crew mutation. "This needs a connection" and "this
 * failed" are different messages in the field — one means wait, the other means
 * something is wrong. Was hand-written across six hooks and four components.
 */
export function toastCrewError(err: unknown, fallback: string) {
  if (isOfflineError(err)) {
    toast.error('This needs a connection. It’ll work once you have signal.')
    return
  }
  console.error('[crew]', err)
  toast.error(fallback)
}
