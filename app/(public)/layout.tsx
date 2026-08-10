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

// Mirrors proxy.ts's ROLE_HOME — where a signed-in employee lands inside the
// app. Kept as its own small copy here rather than importing proxy.ts (which
// runs in the Edge runtime) into this Node.js layout.
const STAFF_HOME: Record<string, string> = {
  owner: '/management/dashboard',
  lead: '/management/dashboard',
  accountant: '/management/billing',
  crew: '/crew/schedule',
}

/**
 * Resolves who's viewing the public site: `canEdit` gates the owner-only
 * inline WYSIWYG editor (task 9.2.5); `staffHome` is non-null for *any*
 * signed-in employee (owner/lead/crew/accountant) and points the header's
 * "Staff log in" link at their actual landing page instead, once they're
 * already signed in.
 */
async function resolveViewer(): Promise<{ canEdit: boolean; staffHome: string | null }> {
  if (!(await hasAuthCookie())) return { canEdit: false, staffHome: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { canEdit: false, staffHome: null }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!employee) return { canEdit: false, staffHome: null }

  return {
    canEdit: employee.role === 'owner',
    staffHome: STAFF_HOME[employee.role] ?? null,
  }
}

/**
 * Chrome for the public marketing site (task 9.2) — top nav + footer, no
 * management sidebar or crew bottom nav. Also resolves `canEdit` for the
 * inline editor (task 9.2.5) so every page under this layout can offer
 * owner-only edit affordances without each one re-deriving it.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { canEdit, staffHome } = await resolveViewer()

  return (
    <EditModeProvider canEdit={canEdit}>
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <PublicHeader staffHome={staffHome} />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </EditModeProvider>
  )
}
