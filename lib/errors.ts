/**
 * The single boundary between machine errors and words a user reads.
 *
 * Task 8.5 rule: no raw error string ever reaches a user. Every Server Action,
 * Route Handler, and mutation funnels its failure through `toUserMessage`, which
 * maps on the *error code* (stable) rather than the message text (not stable, and
 * frequently leaks schema details like `visits_property_id_week_start_key` or
 * `new row violates row-level security policy for table "visits"`).
 *
 * The original error is always logged server-side, so nothing is lost for debugging.
 */

/** Shape of a PostgREST / Supabase error. Not exported by supabase-js in a usable form. */
interface CodedError {
  code?: string
  message?: string
  details?: string
  hint?: string
  status?: number
}

function asCodedError(err: unknown): CodedError | null {
  if (typeof err !== 'object' || err === null) return null
  return err as CodedError
}

/**
 * Postgres SQLSTATE → user copy. These are the codes this app can actually
 * produce; anything else falls through to the caller's fallback.
 *
 * The copy follows the house voice: say what happened, not that we're sorry,
 * and name the next move where there is one.
 */
const PG_CODE_MESSAGES: Record<string, string> = {
  // 23505 unique_violation — the big one. `visits` has a UNIQUE on
  // (property_id, week_start); `employees` and `accounts` have unique emails/names.
  '23505': 'That already exists. Check for a duplicate and try again.',
  // 23503 foreign_key_violation — deleting something still referenced.
  '23503': "That's still in use somewhere else, so it can't be removed.",
  // 23502 not_null_violation, 23514 check_violation — a required/invalid field.
  '23502': 'Something required is missing. Fill in every required field.',
  '23514': "Those values aren't allowed together. Check the form and try again.",
  // 22P02 invalid_text_representation — usually a malformed UUID in a URL.
  '22P02': "That link doesn't point to anything valid.",
  // 42501 insufficient_privilege — RLS denial or a column-guard trigger.
  '42501': "You don't have permission to make that change.",
  // 40001 serialization_failure, 40P01 deadlock_detected — retryable.
  '40001': 'That change collided with another one. Try again.',
  '40P01': 'That change collided with another one. Try again.',
  // 57014 query_canceled / statement timeout.
  '57014': 'That took too long to finish. Try again.',
  // P0001 raise_exception — our own triggers (e.g. the accountant column guard).
  // The trigger text is written for developers, so don't forward it.
  P0001: "That change isn't allowed for your role.",
}

/** PostgREST error codes (the `PGRSTnnn` family), which are not SQLSTATEs. */
const PGRST_CODE_MESSAGES: Record<string, string> = {
  // No rows where exactly one was expected (`.single()`).
  PGRST116: "That record no longer exists — it may have been removed.",
  // JWT / role problems surfaced by PostgREST rather than Postgres.
  PGRST301: 'Your session expired. Sign in again.',
  PGRST302: 'Your session expired. Sign in again.',
}

/** Supabase Auth (GoTrue) messages are user-facing-ish but inconsistent; map the common ones. */
const AUTH_MESSAGE_PATTERNS: [RegExp, string][] = [
  [/already been registered|already exists/i, 'That email is already in use.'],
  [/invalid login credentials/i, "That email and code don't match."],
  [/email rate limit|over_email_send_rate_limit|too many requests/i,
    'Too many sign-in emails were sent. Wait a minute, then try again.'],
  [/token has expired|otp_expired|expired/i, 'That sign-in link expired. Request a new one.'],
  [/user not found/i, "There's no account for that email. Ask an owner to add you."],
]

/** Network-layer failures, which have no code at all — only a message. */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const coded = asCodedError(err)
  if (!coded?.message) return false
  return /failed to fetch|network ?error|networkerror|econnrefused|enotfound|etimedout|socket hang up/i.test(
    coded.message,
  )
}

/**
 * Turn any thrown/returned error into copy a crew member, owner, or accountant
 * can act on. Never returns the underlying message.
 *
 * @param err      whatever was caught or returned (Supabase error, Error, unknown)
 * @param fallback what to say when the error isn't one we recognize. Write this
 *                 per call site and make it specific — "Could not save the
 *                 account." beats "Something went wrong."
 * @param context  optional label for the server log, e.g. `'[createVisit]'`
 */
export function toUserMessage(err: unknown, fallback: string, context?: string): string {
  if (err) console.error(context ?? '[error]', err)

  if (isNetworkError(err)) {
    return "Couldn't reach the server. Check your connection, then try again."
  }

  const coded = asCodedError(err)
  if (!coded) return fallback

  if (coded.code) {
    const pg = PG_CODE_MESSAGES[coded.code]
    if (pg) return pg
    const pgrst = PGRST_CODE_MESSAGES[coded.code]
    if (pgrst) return pgrst
  }

  // Auth errors carry an HTTP status and a message but no PG code.
  if (coded.message) {
    for (const [pattern, message] of AUTH_MESSAGE_PATTERNS) {
      if (pattern.test(coded.message)) return message
    }
  }

  if (coded.status === 401 || coded.status === 403) {
    return "You don't have permission to do that."
  }

  return fallback
}

/**
 * The offline sentinel used across `/crew/*`. Online-only mutations throw
 * `new Error('offline')` rather than attempting a doomed request; several hooks
 * and components duplicated this check before it lived here.
 */
export const OFFLINE_SENTINEL = 'offline'

export function isOfflineError(err: unknown): boolean {
  return err instanceof Error && err.message === OFFLINE_SENTINEL
}

/**
 * Crew-facing variant: an action that needs a connection reads differently from
 * one that genuinely failed, and crew hit the former constantly in the field.
 */
export function toCrewMessage(err: unknown, fallback: string, context?: string): string {
  if (isOfflineError(err)) return 'That needs a connection. Try again once you have signal.'
  return toUserMessage(err, fallback, context)
}

/**
 * Whether a failed read is worth retrying automatically. Used by the React Query
 * retry policy — retrying an RLS denial or an expired session just burns battery
 * and delays the error the user needs to see.
 */
export function isRetryableError(err: unknown): boolean {
  if (isOfflineError(err)) return false
  if (isNetworkError(err)) return true
  const coded = asCodedError(err)
  if (!coded) return true
  if (coded.status === 401 || coded.status === 403) return false
  if (coded.code && ['42501', 'PGRST301', 'PGRST302', 'PGRST116'].includes(coded.code)) return false
  return true
}
