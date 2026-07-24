import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { formatRoleCookie, parseRoleCookie } from '@/lib/utils/role-cookie'

type EmployeeRole = 'owner' | 'lead' | 'crew' | 'accountant'

const ROLE_COOKIE = 'rg-role'
const ROLE_COOKIE_MAX_AGE = 60 * 60 // 1 hour

// Routes accessible per role
const MANAGEMENT_ROLES: EmployeeRole[] = ['owner', 'lead', 'accountant']
const CREW_ROLES: EmployeeRole[] = ['owner', 'lead', 'crew']

// Default redirect when a role is denied access
const ROLE_HOME: Record<EmployeeRole, string> = {
  owner: '/management/dashboard',
  lead: '/management/dashboard',
  accountant: '/management/billing',
  crew: '/crew/today',
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Use anon key with cookies to refresh and validate the session.
  // IMPORTANT: always call getUser() — never skip; it keeps the auth session alive.
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isManagement = pathname.startsWith('/management')
  const isCrew = pathname.startsWith('/crew')
  const isProtected = isManagement || isCrew

  // Unauthenticated user on a protected route → login, clear stale role cookie
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const response = NextResponse.redirect(url)
    response.cookies.delete(ROLE_COOKIE)
    return response
  }

  // Authenticated user on the login page → their dashboard home.
  // Clear the role cookie so a previously-cached role from another user can't carry over.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/management/dashboard'
    const response = NextResponse.redirect(url)
    response.cookies.delete(ROLE_COOKIE)
    return response
  }

  // Role-based access control on protected routes
  if (user && isProtected) {
    // Cookie stores "<userId>_<role>" so a stale cookie from a different user is ignored.
    const rawCookie = request.cookies.get(ROLE_COOKIE)?.value
    const parsed = parseRoleCookie(rawCookie)
    let role: EmployeeRole | undefined =
      parsed?.userId === user.id ? (parsed.role as EmployeeRole) : undefined

    if (!role && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Use service role key to bypass RLS for this internal role lookup.
      // RLS policies on employees are added in Phase 2; using service key here
      // ensures role fetch works before and after those policies land.
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

    // No employee record linked to this auth user — deny access to all protected routes.
    if (!role) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const response = NextResponse.redirect(url)
      response.cookies.delete(ROLE_COOKIE)
      return response
    }

    if (isManagement && !MANAGEMENT_ROLES.includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role] ?? '/crew/today'
      return NextResponse.redirect(url)
    }

    // Team management is owner-only (task 7.1) — leads and accountants are
    // otherwise valid management users, so gate this sub-route specifically.
    if (pathname.startsWith('/management/team') && role !== 'owner') {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role] ?? '/management/dashboard'
      return NextResponse.redirect(url)
    }

    if (isCrew && !CREW_ROLES.includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = ROLE_HOME[role] ?? '/management/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
