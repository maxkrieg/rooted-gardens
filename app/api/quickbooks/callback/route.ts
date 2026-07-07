import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, upsertIntegrationTokens } from '@/lib/quickbooks/client'

const STATE_COOKIE = 'qbo_oauth_state'

/**
 * Handles the QuickBooks OAuth 2.0 redirect back from Intuit. Same
 * self-contained auth story as connect/route.ts — proxy.ts doesn't protect
 * /api/quickbooks/* at all.
 */
export async function GET(request: NextRequest) {
  function toBilling(qbo: string, reason?: string) {
    const url = new URL('/management/billing', request.url)
    url.searchParams.set('qbo', qbo)
    if (reason) url.searchParams.set('reason', reason)
    const response = NextResponse.redirect(url)
    response.cookies.delete(STATE_COOKIE)
    return response
  }

  if (request.nextUrl.searchParams.get('error')) {
    return toBilling('error', 'denied') // user cancelled on Intuit's consent screen
  }

  const state = request.nextUrl.searchParams.get('state')
  const storedState = request.cookies.get(STATE_COOKIE)?.value
  if (!state || !storedState || state !== storedState) {
    return toBilling('error', 'state_mismatch')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'owner') {
    return toBilling('error', 'forbidden')
  }

  try {
    const tokens = await exchangeCodeForTokens(request.url)
    const { error } = await upsertIntegrationTokens(supabase, tokens)
    if (error) return toBilling('error', 'store_failed')
  } catch (err) {
    console.error('[quickbooks/callback]', err)
    return toBilling('error', 'token_exchange_failed')
  }

  return toBilling('connected')
}
