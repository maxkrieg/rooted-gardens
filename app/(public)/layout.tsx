import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { EditModeProvider } from '@/components/public/editing/EditModeProvider'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

// Per-page metadata (generateMetadata in each page.tsx) supplies the real
// title/description; this is the fallback + the Open Graph defaults every
// public page inherits.
export const metadata: Metadata = {
  description:
    'Eco-minded lawn care and garden design serving Norwich, VT and the Upper Valley.',
  openGraph: {
    type: 'website',
    siteName: 'Rooted Gardens',
    locale: 'en_US',
  },
}

/**
 * Is this request's cookie jar even worth a `getUser()` round-trip? Every
 * `@supabase/ssr` session cookie name contains `-auth-token` (chunked long
 * tokens add a numeric suffix, e.g. `-auth-token.0`) — anonymous visitors,
 * the overwhelming majority of public-site traffic, have none of these and
 * skip straight to `canEdit = false` with zero Supabase calls (task 9.2.5).
 * A false positive (a stale cookie with no valid session) just costs one
 * wasted `getUser()` call, never a security issue — RLS is the real gate.
 */
async function hasAuthCookie(): Promise<boolean> {
  const store = await cookies()
  return store.getAll().some((c) => c.name.includes('-auth-token'))
}

async function resolveCanEdit(): Promise<boolean> {
  if (!(await hasAuthCookie())) return false

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return employee?.role === 'owner'
}

/**
 * Chrome for the public marketing site (task 9.2) — top nav + footer, no
 * management sidebar or crew bottom nav. Also resolves `canEdit` for the
 * inline editor (task 9.2.5) so every page under this layout can offer
 * owner-only edit affordances without each one re-deriving it.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const canEdit = await resolveCanEdit()

  return (
    <EditModeProvider canEdit={canEdit}>
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </EditModeProvider>
  )
}
