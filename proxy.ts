import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { formatRoleCookie, parseRoleCookie } from '@/lib/utils/role-cookie'
import { PUBLIC_ROUTES } from '@/lib/content/routes'
import { isNetworkError } from '@/lib/errors'
import { ROLE_HOME, canAccessRoute, isProtectedRoute } from '@/lib/auth/access'
import type { EmployeeRole } from '@/types/app'

const ROLE_COOKIE = 'rg-role'
// 12h: past expiry a cached page renders roleless and read-only. Sign-out clears it at once.
const ROLE_COOKIE_MAX_AGE = 60 * 60 * 12

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Magic links can land on `/?code=` (Supabase Site URL is the root).
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // Public pages skip the getUser() round-trip. /login doesn't: signed-in users get redirected.
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  // Always call getUser() past this point — it keeps the session alive.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  const isProtected = isProtectedRoute(pathname)
  // Exempt ?error=, the no-role dead end, or the redirect loop returns.
  const isLoginWithSession =
    !!user && pathname === '/login' && !request.nextUrl.searchParams.has('error')

  // On weak signal getUser() returns null rather than throwing. Don't sign people out for it.
  const authUnreachable =
    !user &&
    (isNetworkError(authError) ||
      (authError instanceof Error && authError.name === 'AuthRetryableFetchError'))

  // Unauthenticated user on a protected route → login, clear stale role cookie
  if (isProtected && !user && !authUnreachable) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const response = NextResponse.redirect(url)
    response.cookies.delete(ROLE_COOKIE)
    return response
  }

  // Resolve the role once so /login redirects straight to the right home.
  let role: EmployeeRole | undefined
  if (user && (isProtected || isLoginWithSession)) {
    // Cookie stores "<userId>_<role>" so a stale cookie from a different user is ignored.
    const parsed = parseRoleCookie(request.cookies.get(ROLE_COOKIE)?.value)
    role = parsed && parsed.userId === user.id ? (parsed.role as EmployeeRole) : undefined

    if (!role && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Service role key bypasses RLS for this internal role lookup, so it works
      // regardless of the employees policies.
      const serviceClient = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          cookies: { getAll: () => [], setAll: () => {} },
        }
      )

      const { data: employee } = await serviceClient
        .from('employees')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (employee?.role) {
        role = employee.role as EmployeeRole
        supabaseResponse.cookies.set(ROLE_COOKIE, formatRoleCookie(user.id, role), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: ROLE_COOKIE_MAX_AGE,
          path: '/',
        })
      }
    }
  }

  // No employee row for this user: a dead end, since any redirect into the app would loop.
  if (user && !role && (isProtected || isLoginWithSession)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = '?error=no-employee-record'
    const response = NextResponse.redirect(url)
    response.cookies.delete(ROLE_COOKIE)
    return response
  }

  // Authenticated user on the login page → straight to their own home.
  if (isLoginWithSession && role) {
    const url = request.nextUrl.clone()
    url.pathname = ROLE_HOME[role]
    url.search = ''
    return NextResponse.redirect(url)
  }

  // One allowlist (lib/auth/access.ts) drives this gate and the nav. RLS is the real boundary.
  if (user && role && isProtected && !canAccessRoute(pathname, role)) {
    const url = request.nextUrl.clone()
    url.pathname = ROLE_HOME[role]
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip all of _next/, the service worker and the manifest: none of them should pay a getUser()
    // round-trip (it fed a dev-server livelock), and the worker must never redirect to /login.
    '/((?!_next/|favicon.ico|serwist/|manifest[\\w-]*\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
