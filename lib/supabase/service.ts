import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service-role client — bypasses RLS entirely. Server-only; never expose its
 * results to a Client Component. Use only for internal infra reads/writes that
 * must work regardless of the caller's business role (e.g. QuickBooks token
 * storage/refresh, needed by whichever role triggers a sync). Prefer
 * lib/supabase/server.ts for anything user-facing.
 */
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
