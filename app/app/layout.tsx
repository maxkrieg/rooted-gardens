import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getSeedRole } from '@/lib/auth/server-role'
import { AppShell } from '@/components/app/AppShell'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

/**
 * PWA metadata for the merged field app. Kept off the root layout so anonymous
 * marketing visitors still aren't offered an install.
 */
export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // 'black-translucent' lets the app paint under the status bar, which is what
    // the root layout's viewportFit: 'cover' assumes. Pairs with the safe-area
    // insets used by the bottom bar and sheet footers.
    statusBarStyle: 'black-translucent',
    title: 'Rooted Gardens',
  },
}

/**
 * A `'use client'` layout can't export `metadata`, so all the interactive shell
 * (nav, offline queue flush, realtime) lives in AppShell and this stays a thin
 * server component.
 *
 * Role comes from the `rg-role` cookie rather than a DB round-trip: this layout
 * has to render offline, where a Supabase query can't resolve. AppShell
 * reconciles it against `employees.role` client-side.
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
