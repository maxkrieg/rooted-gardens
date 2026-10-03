import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isSuperAdmin } from '@/lib/auth/super-admin'
import { impersonationConfigured } from '@/lib/auth/impersonation'
import { ErrorState } from '@/components/states/ErrorState'
import { ImpersonateList, type ImpersonateTarget } from '@/components/admin/ImpersonateList'

export const metadata: Metadata = { title: 'Impersonate', robots: { index: false } }

/**
 * Super-admin only (also gated in proxy.ts). Outside AppShell on purpose: the super admin need
 * not have an employee row, and AppShell assumes one. Server-first and online-only, like a desk
 * route.
 */
export default async function ImpersonatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isSuperAdmin(user.id)) redirect('/app/schedule')

  if (!impersonationConfigured()) {
    return (
      <Shell>
        <ErrorState
          title="Impersonation isn't configured."
          hint="Set IMPERSONATION_SECRET and SUPABASE_SERVICE_ROLE_KEY on the server."
        />
      </Shell>
    )
  }

  // Service client: the super admin may have no employee row, so RLS would show them nothing.
  const service = createServiceClient()
  const { data: employees, error } = await service
    .from('employees')
    .select('id, name, role, side, active, user_id')
    .order('active', { ascending: false })
    .order('name')

  if (error) {
    console.error('[admin/impersonate] employees', error)
    return (
      <Shell>
        <ErrorState title="The team didn't load." hint="Check your connection, then try again." />
      </Shell>
    )
  }

  const targets: ImpersonateTarget[] = (employees ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    side: e.side,
    active: e.active,
    hasLogin: !!e.user_id,
    isSuperAdmin: isSuperAdmin(e.user_id),
  }))

  const hasOwnEmployee = targets.some((t) => t.isSuperAdmin)

  return (
    <Shell email={user.email} backToApp={hasOwnEmployee}>
      <ImpersonateList targets={targets} live={process.env.VERCEL_ENV === 'production'} />
    </Shell>
  )
}

function Shell({
  email,
  backToApp,
  children,
}: {
  email?: string | null
  backToApp?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Super admin
            </p>
            <h1 className="font-display text-3xl font-semibold text-foreground">Impersonate</h1>
            {email && <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>}
          </div>
          {backToApp && (
            <Link
              href="/app/schedule"
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-accent"
            >
              Back to the app
            </Link>
          )}
        </header>
        {children}
      </div>
    </div>
  )
}
