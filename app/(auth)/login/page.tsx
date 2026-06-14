'use client'

import { use, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
  const [error, setError] = useState<string | null>(
    params.error ? (params.detail ?? 'Sign-in failed — try again.') : null
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
      setError(authError.message)
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
