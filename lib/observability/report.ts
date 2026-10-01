import * as Sentry from '@sentry/nextjs'

interface ReportOptions {
  level?: 'error' | 'warning'
  tags?: Record<string, string | number | undefined>
  /** Replaces the error's own message — for errors whose raw text or fields may hold customer data. */
  message?: string
}

/**
 * PostgREST/QBO errors are often plain objects, and `details` can hold a failing row (addresses,
 * notes). Only `code` and `message` survive; the rest of the object is never sent.
 */
function normalize(err: unknown, message?: string): { error: Error; code?: string } {
  const coded = typeof err === 'object' && err !== null ? (err as { code?: unknown }) : null
  const code = typeof coded?.code === 'string' ? coded.code : undefined

  if (err instanceof Error && !message) return { error: err, code }

  const text =
    message ??
    (typeof err === 'string'
      ? err
      : typeof (err as { message?: unknown } | null)?.message === 'string'
        ? (err as { message: string }).message
        : 'Non-Error thrown')
  const error = new Error(code ? `[${code}] ${text}` : text)
  error.name = err instanceof Error ? err.name : 'ReportedError'
  // Keep the real frames; Sentry takes the value from `message`, not the stack's first line.
  if (err instanceof Error && err.stack) error.stack = err.stack
  return { error, code }
}

/** Send an error to Sentry. `context` is the same `[label]` the console line uses. No-op without a DSN. */
export function reportError(err: unknown, context: string, options: ReportOptions = {}): void {
  const { error, code } = normalize(err, options.message)
  Sentry.captureException(error, {
    level: options.level ?? 'error',
    tags: { context, ...(code ? { error_code: code } : {}), ...options.tags },
    // Errors built here share report.ts frames; group by call site + code instead.
    fingerprint: error === err ? undefined : ['{{ default }}', context, code ?? ''],
  })
}
