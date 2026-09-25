import { createHmac } from 'node:crypto'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import type { LeadKind } from '@/types/app'

/** Submissions faster than this are treated as bots. */
const MIN_FORM_SECONDS_MS = 2000

/** Two windows, so a quick retry isn't punished like sustained abuse. */
const SHORT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const SHORT_WINDOW_LIMIT = 3
const LONG_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
const LONG_WINDOW_LIMIT = 10

/** Rows older than this are pruned opportunistically on every rate-limit
 *  check, so `lead_submissions` never needs its own cron job. */
const PRUNE_AFTER_MS = LONG_WINDOW_MS

/** First entry of x-forwarded-for. Null when absent; callers then share one bucket. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null
  return h.get('x-real-ip')
}

/** HMAC of the IP, keyed by the service-role key. Raw IPs are never stored. */
export function hashIp(ip: string): string {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest('hex')
}

type SpamSignal = 'honeypot' | 'too_fast'

/** Cheap no-DB bot checks, run before the rate limit. */
export function checkLeadSpamSignals(input: { website: string; elapsedMs: number }): SpamSignal | null {
  if (input.website.trim().length > 0) return 'honeypot'
  if (input.elapsedMs < MIN_FORM_SECONDS_MS) return 'too_fast'
  return null
}

/**
 * DB-backed sliding-window limit by hashed IP (in-memory counters don't survive serverless).
 * Over the limit it writes nothing; otherwise records the attempt and prunes old rows.
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
