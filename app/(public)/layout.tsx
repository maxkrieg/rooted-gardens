import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/lib/auth/access'
import type { EmployeeRole } from '@/types/app'
import { EditModeProvider } from '@/components/public/editing/EditModeProvider'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

// Fallback title plus Open Graph defaults; each page's generateMetadata supplies the rest.
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
 * Only call getUser() if a Supabase auth cookie exists, so anonymous visitors cost no
 * Supabase calls. A stale cookie just wastes one call; RLS is the gate.
 */
async function hasAuthCookie(): Promise<boolean> {
  const store = await cookies()
  return store.getAll().some((c) => c.name.includes('-auth-token'))
}

/** `canEdit` gates the owner's inline editor; `staffHome` points signed-in staff at their home. */
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
    staffHome: ROLE_HOME[employee.role as EmployeeRole] ?? null,
  }
}

/** Public site chrome (top nav + footer). Resolves `canEdit` once for every page. */
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
