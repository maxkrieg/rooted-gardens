import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQboAuthorizationUrl } from '@/lib/quickbooks/client'

const STATE_COOKIE = 'qbo_oauth_state'
const STATE_COOKIE_MAX_AGE = 60 * 10 // 10 minutes

/**
 * Initiates the QuickBooks OAuth 2.0 flow. proxy.ts does NOT protect
 * /api/quickbooks/* routes (its route-matching only covers /management/* and
 * /crew/*), so this handler does its own complete auth + owner-role check
 * rather than relying on any upstream gating.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'owner') {
    const url = new URL('/management/billing', request.url)
    url.searchParams.set('qbo', 'error')
    url.searchParams.set('reason', 'forbidden')
    return NextResponse.redirect(url)
  }

  const state = crypto.randomBytes(16).toString('hex')
  const response = NextResponse.redirect(getQboAuthorizationUrl(state))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
