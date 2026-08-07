import { createHmac } from 'node:crypto'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import type { LeadKind } from '@/types/app'

/** How long the honeypot/timing form has to be visible before a submission
 *  is treated as (probably) a human. Real visitors reading name/email/phone/
 *  address/message fields take several seconds; a scripted bot posts near
 *  -instantly. */
const MIN_FORM_SECONDS_MS = 2000

/** Sliding-window caps enforced by `enforceLeadRateLimit`. Two windows so a
 *  quick burst (a double-click, a retry after a typo) isn't punished as hard
 *  as sustained abuse over a day. */
const SHORT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const SHORT_WINDOW_LIMIT = 3
const LONG_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
const LONG_WINDOW_LIMIT = 10

/** Rows older than this are pruned opportunistically on every rate-limit
 *  check, so `lead_submissions` never needs its own cron job. */
const PRUNE_AFTER_MS = LONG_WINDOW_MS

/**
 * Reads the client's IP off the standard proxy headers Vercel sets
 * (`x-forwarded-for` may be a comma-separated chain — the first entry is the
 * original client). Returns `null`, never throws, when nothing is present
 * (e.g. local dev without a proxy in front) — callers fall back to a single
 * shared bucket rather than skipping the limit outright.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null
  return h.get('x-real-ip')
}

/**
 * HMAC-SHA256 of the IP, keyed by the service-role key (already a
 * server-only secret we hold — no new env var needed). We never store the
 * raw address: this table exists purely to count attempts, and the owners
 * never read it.
 */
export function hashIp(ip: string): string {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest('hex')
}

export type SpamSignal = 'honeypot' | 'too_fast'

/**
 * Cheap, no-DB checks against the two anti-spam fields every public lead
 * form carries. Called before the rate limit (no point spending a DB
 * round-trip on a submission that's obviously a bot).
 */
export function checkLeadSpamSignals(input: { website: string; elapsedMs: number }): SpamSignal | null {
  if (input.website.trim().length > 0) return 'honeypot'
  if (input.elapsedMs < MIN_FORM_SECONDS_MS) return 'too_fast'
  return null
}

/**
 * DB-backed sliding-window rate limit, keyed by hashed IP. A plain
 * in-process counter would reset on every cold start and is scoped to a
 * single serverless instance — neither holds up on Vercel, where each
 * request can land on a different instance. Returns `{ limited: true }`
 * without writing a row when the caller is already over a window (no reason
 * to let a flood pad its own counter); otherwise records this attempt and
 * opportunistically prunes anything older than the long window.
 */
export async function enforceLeadRateLimit(
  ipHash: string,
  kind: LeadKind,
): Promise<{ limited: boolean }> {
  const supabase = createServiceClient()
  const now = Date.now()

  const { count: shortCount } = await supabase
    .from('lead_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(now - SHORT_WINDOW_MS).toISOString())

  const { count: longCount } = await supabase
    .from('lead_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(now - LONG_WINDOW_MS).toISOString())

  if ((shortCount ?? 0) >= SHORT_WINDOW_LIMIT || (longCount ?? 0) >= LONG_WINDOW_LIMIT) {
    return { limited: true }
  }

  await supabase.from('lead_submissions').insert({ ip_hash: ipHash, kind })

  // Opportunistic prune — piggybacks on a real request instead of a cron.
  // Fire-and-forget: a failed prune just means slightly more rows next time,
  // never a correctness issue.
  void supabase
    .from('lead_submissions')
    .delete()
    .lt('created_at', new Date(now - PRUNE_AFTER_MS).toISOString())

  return { limited: false }
}
