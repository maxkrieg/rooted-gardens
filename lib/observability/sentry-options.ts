import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'

/**
 * Options shared by the browser, Node and Edge Sentry inits. Imported by instrumentation-client.ts
 * and the proxy's runtime, so keep it dependency-free.
 *
 * Privacy: this app holds gate codes (properties.access_notes), addresses, client notes and
 * resumes, and every Server Action body carries some of them. Nothing from a request body, cookie,
 * query string or header leaves the process — only the error, its stack, the route and who hit it
 * (employee id + role, never name or email). Unset DSN = Sentry off (local dev).
 */

const KEEP_HEADERS = new Set(['user-agent', 'content-type', 'next-action'])

/** Query strings carry magic-link tokens (`?code=`, `token_hash`) and PostgREST filters. */
function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    if (event.request.url) event.request.url = stripQuery(event.request.url)
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(([k]) => KEEP_HEADERS.has(k.toLowerCase())),
      )
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined
  return event
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const data = crumb.data
  if (data) {
    if (typeof data.url === 'string') data.url = stripQuery(data.url)
    if (typeof data.from === 'string') data.from = stripQuery(data.from)
    if (typeof data.to === 'string') data.to = stripQuery(data.to)
  }
  return crumb
}

export const sharedSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // NEXT_PUBLIC_VERCEL_ENV is exposed to the browser by Vercel's system env vars.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
  // Errors only. Tracing would ship Supabase request URLs (filters by address, name) as span
  // names, and ~20 users don't need performance sampling to find a slow query.
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
}
