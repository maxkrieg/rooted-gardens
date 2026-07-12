import OAuthClient from 'intuit-oauth'
import QuickBooks from 'node-quickbooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createServiceClient } from '@/lib/supabase/service'

// Refresh proactively if the stored token is expiring within this window.
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export type QboConnectionStatus = 'connected' | 'disconnected' | 'expired'

interface StoredTokens {
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string // ISO
}

function qboEnvironment(): 'sandbox' | 'production' {
  return process.env.QBO_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

/** Constructs the intuit-oauth client from env vars. All intuit-oauth specifics
 *  stay behind this file — route handlers never import it directly. */
export function createQboOAuthClient(): OAuthClient {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    environment: qboEnvironment(),
    redirectUri: process.env.QBO_REDIRECT_URI!,
  })
}

/** Builds the Intuit consent-screen URL for the given CSRF state. */
export function getQboAuthorizationUrl(state: string): string {
  return createQboOAuthClient().authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  })
}

/** Exchanges the full callback URL (code/state/realmId in the query string)
 *  for tokens. */
export async function exchangeCodeForTokens(callbackUrl: string): Promise<StoredTokens> {
  const oauthClient = createQboOAuthClient()
  const authResponse = await oauthClient.createToken(callbackUrl)
  const json = authResponse.getJson()
  const realmId = oauthClient.token.realmId

  if (!realmId) {
    throw new Error('QuickBooks callback did not include a realmId')
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    realm_id: realmId,
    token_expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  }
}

/**
 * Select-then-insert-or-update against `integrations` — there's no unique
 * constraint on `service`, so no `onConflict` upsert shortcut (same
 * pre-check-then-write convention as assignProperty in
 * app/management/route-groups/actions.ts). Caller supplies the Supabase
 * client: the OAuth callback passes the normal RLS client (owner-gated write,
 * defense-in-depth alongside its own explicit role check); the token-refresh
 * path below passes the service client.
 */
export async function upsertIntegrationTokens(
  supabase: SupabaseClient<Database>,
  tokens: StoredTokens,
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('service', 'quickbooks')
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('integrations').update(tokens).eq('id', existing.id)
    : await supabase.from('integrations').insert({ service: 'quickbooks', ...tokens })

  if (error) {
    console.error('[upsertIntegrationTokens]', error)
    return { error: error.message }
  }
  return {}
}

interface IntegrationRow {
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string | null
}

/**
 * Returns fresh tokens for `row`, refreshing against Intuit first if the
 * stored access token is expired or expiring within `REFRESH_BUFFER_MS`.
 * Persists a successful refresh via `upsertIntegrationTokens`. Shared by
 * `getQuickBooksClient` (needs a usable client) and `getQboConnectionStatus`
 * (needs to know whether the *refresh token* — not just the short-lived
 * access token — still works). Throws if Intuit rejects the refresh (e.g. the
 * refresh token itself was revoked or expired) — that's the one case that
 * actually requires the user to reconnect.
 */
async function ensureFreshTokens(
  supabase: SupabaseClient<Database>,
  row: IntegrationRow,
): Promise<StoredTokens> {
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  if (expiresAt - Date.now() >= REFRESH_BUFFER_MS) {
    return { ...row, token_expires_at: row.token_expires_at! }
  }

  const oauthClient = createQboOAuthClient()
  const authResponse = await oauthClient.refreshUsingToken(row.refresh_token)
  const json = authResponse.getJson()
  const tokens: StoredTokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    realm_id: row.realm_id,
    token_expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  }

  await upsertIntegrationTokens(supabase, tokens)
  return tokens
}

/**
 * Connection status for the billing page's status badge — visible to every
 * role, so this goes through the service client (integrations RLS is
 * owner-only). Actually attempts a refresh when the stored access token looks
 * expired, rather than just reading the stale `token_expires_at` column: a
 * QBO access token expires every ~hour regardless of activity, so a purely
 * passive read would show "Expired" (with a "Connect QuickBooks" button)
 * after any hour of inactivity even though the long-lived refresh token is
 * still perfectly valid and the next real action would refresh it silently
 * anyway. Reporting that as "Expired" — the same label/button shown for a
 * truly broken connection — was confusing. Only a failed refresh (the
 * *refresh* token itself no longer works) is reported as 'expired' now.
 */
export async function getQboConnectionStatus(): Promise<QboConnectionStatus> {
  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('integrations')
    .select('access_token, refresh_token, realm_id, token_expires_at')
    .eq('service', 'quickbooks')
    .maybeSingle()

  if (!row?.access_token || !row.refresh_token || !row.realm_id) return 'disconnected'

  try {
    await ensureFreshTokens(supabase, {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      realm_id: row.realm_id,
      token_expires_at: row.token_expires_at,
    })
    return 'connected'
  } catch (err) {
    console.error('[getQboConnectionStatus] refresh failed', err)
    return 'expired'
  }
}

/**
 * Returns an authenticated node-quickbooks client, refreshing the token first
 * if it's expired or expiring within the next 5 minutes. Uses the service
 * client throughout so it works under any calling role (an
 * accountant-triggered sync must still be able to read the tokens, which the
 * owner-only integrations RLS would otherwise block).
 */
export async function getQuickBooksClient(): Promise<QuickBooks> {
  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from('integrations')
    .select('access_token, refresh_token, realm_id, token_expires_at')
    .eq('service', 'quickbooks')
    .maybeSingle()

  if (error || !row?.access_token || !row.refresh_token || !row.realm_id) {
    throw new Error('QuickBooks is not connected')
  }

  const tokens = await ensureFreshTokens(supabase, {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    realm_id: row.realm_id,
    token_expires_at: row.token_expires_at,
  })

  return new QuickBooks(
    process.env.QBO_CLIENT_ID!,
    process.env.QBO_CLIENT_SECRET!,
    tokens.access_token,
    false,
    tokens.realm_id,
    qboEnvironment() !== 'production',
    false,
    null,
    '2.0',
    tokens.refresh_token,
  )
}

/**
 * Wraps a node-quickbooks callback-style method as a Promise — node-quickbooks
 * predates promises entirely (every method takes a final `(err, result) => void`
 * callback). Shared adapter reused by lib/quickbooks/sync.ts and, later,
 * invoice push (5.4), instead of each call site hand-rolling its own.
 */
export function qboPromise<T>(
  fn: (callback: (err: unknown, result: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}
