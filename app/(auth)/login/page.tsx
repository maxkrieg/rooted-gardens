'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toUserMessage } from '@/lib/errors'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>
}) {
  return <LoginForm searchParamsPromise={searchParams} />
}

function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ error?: string; detail?: string }>
}) {
  const params = use(searchParamsPromise)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  // `?detail=` used to carry the raw GoTrue message straight into the page; the
  // callback no longer sends it. An expired or already-used link is by far the
  // most common cause, so name it rather than saying "sign-in failed".
  // `no-employee-record` is a distinct case from proxy.ts: the sign-in itself
  // worked, but there's no `employees` row for this auth user — requesting a
  // new magic link would just loop back here, so say that instead.
  const [error, setError] = useState<string | null>(
    params.error === 'no-employee-record'
      ? 'You’re signed in, but this account isn’t set up as a team member yet. Ask an owner to add you.'
      : params.error
        ? 'That sign-in link didn’t work. It may have expired — request a new one below.'
        : null
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(
        toUserMessage(authError, 'Could not send the sign-in email. Try again.', '[login]'),
      )
      setLoading(false)
    } else {
      setSubmitted(true)
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm rounded-2xl shadow-warm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 text-3xl">✉️</div>
            <CardTitle className="font-display text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a magic link to <span className="font-medium text-foreground">{email}</span>.
              Click the link to sign in — no password needed.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Since / became the public marketing home (task 9.2), staff landing
            here on a stale bookmark or a mistyped URL need a way back out. */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the site
        </Link>

        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">
            Rooted Gardens
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Internal team portal</p>
        </div>

        <Card className="rounded-2xl shadow-warm">
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>
              Enter your work email — we&apos;ll send you a magic link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@rootedgardens.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 text-base"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
