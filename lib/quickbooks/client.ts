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

/**
 * Read-only connection status for the billing page's status badge — visible
 * to every role, so this goes through the service client (integrations RLS is
 * owner-only) but selects only `token_expires_at`, never the tokens
 * themselves. Deliberately simple: no speculative refresh just to report
 * status — that's what getQuickBooksClient is for when 5.3/5.4 actually use it.
 */
export async function getQboConnectionStatus(): Promise<QboConnectionStatus> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('integrations')
    .select('token_expires_at')
    .eq('service', 'quickbooks')
    .maybeSingle()

  if (!data) return 'disconnected'
  if (!data.token_expires_at) return 'expired'
  return new Date(data.token_expires_at).getTime() > Date.now() ? 'connected' : 'expired'
}

/**
 * Returns an authenticated node-quickbooks client, refreshing the token first
 * if it's expired or expiring within the next 5 minutes. Not called by task
 * 5.2 itself — exported for 5.3 (customer sync) / 5.4 (invoice push) to
 * consume. Uses the service client throughout so it works under any calling
 * role (an accountant-triggered sync must still be able to read the tokens,
 * which the owner-only integrations RLS would otherwise block).
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

  let accessToken = row.access_token
  let refreshToken = row.refresh_token
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0

  if (expiresAt - Date.now() < REFRESH_BUFFER_MS) {
    const oauthClient = createQboOAuthClient()
    const authResponse = await oauthClient.refreshUsingToken(refreshToken)
    const json = authResponse.getJson()
    accessToken = json.access_token
    refreshToken = json.refresh_token

    await upsertIntegrationTokens(supabase, {
      access_token: accessToken,
      refresh_token: refreshToken,
      realm_id: row.realm_id,
      token_expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    })
  }

  return new QuickBooks(
    process.env.QBO_CLIENT_ID!,
    process.env.QBO_CLIENT_SECRET!,
    accessToken,
    false,
    row.realm_id,
    qboEnvironment() !== 'production',
    false,
    null,
    '2.0',
    refreshToken,
  )
}
