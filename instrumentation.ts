import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

/** Uncaught errors from Server Components, Server Actions, Route Handlers and the proxy. */
export const onRequestError = Sentry.captureRequestError
