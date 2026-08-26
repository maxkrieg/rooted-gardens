import { createClient } from '@/lib/supabase/server'
import { getSeedRole } from '@/lib/auth/server-role'
import { AppShell } from '@/components/app/AppShell'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

/**
 * The desk routes — billing, team, fleet, leads, reports. They kept their
 * `/management/*` URLs (only the field routes moved to `/app/*`), but they now
 * render inside the same AppShell, so there is one nav in the app rather than
 * a sidebar here and a bottom bar there.
 *
 * No `metadata` export: the merged manifest lives on app/app/layout.tsx, and an
 * install started from a desk route should still yield the field app.
 */
export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const role = await getSeedRole(user?.id)

  return (
    <>
      <ServiceWorkerRegistration />
      <AppShell initialRole={role} userId={user?.id} userEmail={user?.email}>
        <div className="p-4 lg:p-6">{children}</div>
      </AppShell>
    </>
  )
}
