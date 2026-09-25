import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getSeedRole } from '@/lib/auth/server-role'
import { AppShell } from '@/components/app/AppShell'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

/** PWA metadata, kept off the root layout so marketing visitors aren't offered an install. */
export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // Paints under the status bar, matching viewportFit: 'cover' and the safe-area insets.
    statusBarStyle: 'black-translucent',
    title: 'Rooted Gardens',
  },
}

/**
 * Thin server layout (a client layout can't export metadata). Role comes from the cookie so
 * this renders offline; AppShell reconciles it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const role = await getSeedRole(user?.id)

  return (
    <>
      <ServiceWorkerRegistration />
      <AppShell initialRole={role} userId={user?.id} userEmail={user?.email}>
        {children}
      </AppShell>
    </>
  )
}
