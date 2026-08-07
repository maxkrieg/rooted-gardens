import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Always-`anon` client — no cookies, no session. Server-only.
 *
 * `lib/supabase/server.ts`'s client reads the request's session cookies, so
 * a *signed-in* visitor (e.g. a crew member) submitting the public inquiry
 * form would authenticate as `authenticated`/their own role instead of
 * `anon`, and get denied by both `leads` INSERT policies —
 * `leads_insert_anon` is `TO anon` only, `leads_insert_staff` requires
 * owner/lead. The public marketing form must always insert as `anon`,
 * regardless of who happens to be browsing it, so it needs a client that
 * never sees cookies at all. Use only for the public lead-intake Server
 * Actions (9.5/9.6) — anything user-facing that should honor a signed-in
 * session belongs on lib/supabase/server.ts instead.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
