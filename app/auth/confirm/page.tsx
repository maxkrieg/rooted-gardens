'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Implicit-flow landing page — the client-side half of `/auth/callback`.
 *
 * Magic links the app itself requests (`signInWithOtp` on the login page) use
 * PKCE and come back as `?code=`, which `/auth/callback` exchanges server-side.
 * Admin-generated links do not: `auth.admin.inviteUserByEmail` (the Team page's
 * "Invite to App") has no browser-side code verifier, so GoTrue falls back to
 * the implicit flow and returns the session in the URL *fragment*:
 *
 *   /auth/confirm#access_token=…&refresh_token=…&type=invite
 *
 * Fragments are never transmitted to the server, so no Route Handler, Server
 * Component, or proxy can read one — only the browser can. This page reads it,
 * installs the session (which `@supabase/ssr`'s browser client writes to
 * cookies, so the proxy and every Server Component see it on the next request),
 * then hands off to the destination.
 */
export default function AuthConfirmPage() {
  useEffect(() => {
    // Cancels the redirect if the component unmounts mid-flight.
    let active = true

    async function completeSignIn() {
      const hash = window.location.hash.replace(/^#/, '')
      const hashParams = new URLSearchParams(hash)

      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      // GoTrue reports implicit-flow failures (expired/consumed link) in the
      // fragment too, e.g. `#error=access_denied&error_description=…`.
      const hashError = hashParams.get('error')

      if (hashError || !accessToken || !refreshToken) {
        if (hashError) {
          console.error('[auth/confirm] link error:', hashError, hashParams.get('error_description'))
        } else {
          console.error('[auth/confirm] no session tokens in URL fragment')
        }
        window.location.replace('/login?error=auth_failed')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (!active) return

      if (error) {
        console.error('[auth/confirm] setSession error:', error)
        window.location.replace('/login?error=auth_failed')
        return
      }

      // Only same-origin relative paths — never redirect somewhere a crafted
      // `?next=` points. `//evil.com` is protocol-relative, hence the second check.
      const requested = new URLSearchParams(window.location.search).get('next')
      const next =
        requested && requested.startsWith('/') && !requested.startsWith('//')
          ? requested
          : '/management/dashboard'

      // Drop the tokens from the address bar (and this entry in history) before
      // navigating on, so they aren't left sitting in the URL or back-stack.
      window.history.replaceState(null, '', window.location.pathname)

      // Full navigation rather than a client-side push: the session cookies were
      // just written, and this guarantees the proxy re-runs and role-gates with
      // them present.
      window.location.replace(next)
    }

    completeSignIn()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-warm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 text-3xl">🌿</div>
          <CardTitle className="font-display text-xl">Signing you in…</CardTitle>
          <CardDescription>One moment while we finish setting up your session.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}
