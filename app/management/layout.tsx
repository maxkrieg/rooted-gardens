import { createClient } from '@/lib/supabase/server'
import { ManagementNav } from '@/components/management/ManagementNav'

export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <ManagementNav userEmail={user?.email} />

      {/* Main content area:
          - Mobile: offset below the fixed top header (h-14 = pt-14)
          - Desktop: offset right of the fixed sidebar (w-56 = ml-56), no top padding */}
      <main className="lg:ml-56 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6 h-full">{children}</div>
      </main>
    </div>
  )
}
