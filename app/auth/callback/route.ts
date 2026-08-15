import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/management/dashboard'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    // The raw GoTrue message used to ride along in `?detail=` and render on the
    // login page. It said nothing useful to a crew member and put internals in a
    // shareable URL — the login page now writes its own copy from the code alone.
    console.error('[auth/callback] exchangeCodeForSession error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }

  // No `?code=` — this is the implicit flow, not PKCE. Admin-generated links
  // (`auth.admin.inviteUserByEmail`, used by the Team page's "Invite to App")
  // have no browser-side code verifier, so GoTrue returns the session in the URL
  // *fragment* instead: `#access_token=…&refresh_token=…&type=invite`. A fragment
  // is never sent to the server, so this handler structurally cannot read it —
  // hand off to a client page that can. The fragment rides along through the
  // redirect on its own (the browser preserves it when the Location has none).
  const confirmUrl = new URL('/auth/confirm', request.url)
  confirmUrl.searchParams.set('next', next)
  return NextResponse.redirect(confirmUrl)
}
