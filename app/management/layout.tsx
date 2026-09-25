import { createClient } from '@/lib/supabase/server'
import { getSeedRole } from '@/lib/auth/server-role'
import { AppShell } from '@/components/app/AppShell'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

/** The desk routes, inside the same AppShell. No metadata: installs should yield the field app. */
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
