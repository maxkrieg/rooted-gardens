import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Always-anon client with no cookies, for the public lead forms. The cookie client would insert
 * as a signed-in visitor's role, which the anon-only leads policy rejects.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
