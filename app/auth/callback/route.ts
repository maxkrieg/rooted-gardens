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

  console.error('[auth/callback] no code param in request:', request.url)
  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
