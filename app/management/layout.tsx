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

  // Role drives which nav items show (e.g. Team is owner-only, task 7.1).
  // A failed lookup silently hides items, which reads as lost features rather
  // than an error — so log it. Access is still gated by proxy.ts and RLS.
  let role: string | null = null
  if (user) {
    const { data: employee, error } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (error) console.error('[management/layout] role lookup', error)
    role = employee?.role ?? null
  }

  // Starting count for the Leads sidebar badge (task 9.7) — the nav's realtime
  // effect re-queries this on every `leads` event, but a server-fetched
  // starting value avoids a flash of "0" on first paint. Non-fatal: leads
  // RLS only admits owner/lead, so this is a no-op (and logged) for anyone else.
  let initialNewLeadCount = 0
  if (role === 'owner' || role === 'lead') {
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
    if (error) console.error('[management/layout] new-lead count', error)
    initialNewLeadCount = count ?? 0
  }

  // Starting count for the Routes sidebar badge — every property with no
  // property_route_groups row. property_route_groups_property_idx guarantees
  // at most one row per property, so unrouted = properties − routed, two
  // cheap head counts instead of an anti-join. The Routes nav item has no
  // `roles` restriction, so owner/lead/accountant all see it.
  let initialUnroutedCount = 0
  if (role === 'owner' || role === 'lead' || role === 'accountant') {
    const [propertiesCount, routedCount] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('is_archived', false),
      supabase.from('property_route_groups').select('property_id', { count: 'exact', head: true }),
    ])
    if (propertiesCount.error) console.error('[management/layout] properties count', propertiesCount.error)
    if (routedCount.error) console.error('[management/layout] routed count', routedCount.error)
    initialUnroutedCount = Math.max((propertiesCount.count ?? 0) - (routedCount.count ?? 0), 0)
  }

  return (
    // dvh, not vh — iOS Safari's collapsing URL bar makes 100vh taller than the
    // visible viewport, which left a sliver of dead space at the bottom.
    <div className="min-h-[100dvh] bg-background">
      <ManagementNav
        userEmail={user?.email}
        role={role}
        initialNewLeadCount={initialNewLeadCount}
        initialUnroutedCount={initialUnroutedCount}
      />

      {/* Main content area:
          - Mobile: offset below the fixed top header, whose own height already
            absorbs the safe-area inset (see ManagementNav) — match it here too.
          - Desktop: offset right of the fixed sidebar (w-56 = ml-56), no top padding */}
      <main className="lg:ml-56 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 min-h-[100dvh]">
        <div className="p-4 lg:p-6 h-full">{children}</div>
      </main>
    </div>
  )
}
