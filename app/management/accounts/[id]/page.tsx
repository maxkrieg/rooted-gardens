import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AccountStatusBadge,
  BillingTypeBadge,
} from '@/components/management/badges'
import { EditAccountSheet } from '@/components/management/EditAccountSheet'
import { PropertySheet } from '@/components/management/PropertySheet'
import { QboLinkStatus } from '@/components/management/QboLinkStatus'
import { FrequencyBadge } from '@/components/management/badges'
import { RecentVisitsList } from '@/components/management/RecentVisitsList'
import { createClient } from '@/lib/supabase/server'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import type { AccountWithDetails, EmployeeRole, RecentVisit } from '@/types/app'

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // ── 1. Account + properties ────────────────────────────────────────────────
  const accountResult = await supabase.from('accounts').select('*, properties(*)').eq('id', id).single()

  if (accountResult.error || !accountResult.data) {
    notFound()
  }

  const account = {
    ...accountResult.data,
    properties: [...accountResult.data.properties].sort((a, b) => a.address.localeCompare(b.address)),
  } as AccountWithDetails

  const propertyIds = account.properties.map((p) => p.id)

  // ── 2. Recent visits, and each property's current route group ─────────────
  const [visitsResult, routeGroupAssignments] = await Promise.all([
    // Full property + visit_crew(employee) join — needed to open VisitDetailSheet
    // directly from a row, same shape it already gets from the schedule grid.
    supabase
      .from('visits')
      .select('*, property:properties(*), visit_crew(*, employee:employees(*))')
      .eq('account_id', id)
      .eq('status', 'completed')
      .order('week_start', { ascending: false })
      .limit(10),
    propertyIds.length > 0
      ? supabase
          .from('property_route_groups')
          .select('property_id, route_groups(id, name)')
          .in('property_id', propertyIds)
      : Promise.resolve({ data: [] as { property_id: string; route_groups: { id: string; name: string } | null }[] }),
  ])

  const visits = (visitsResult.data ?? []) as RecentVisit[]

  const routeGroupByPropertyId = new Map<string, { id: string; name: string }>()
  for (const row of routeGroupAssignments.data ?? []) {
    if (row.route_groups) routeGroupByPropertyId.set(row.property_id, row.route_groups)
  }

  // role mirrors app/management/schedule/page.tsx's derivation from the rg-role cookie.
  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'crew'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Back nav */}
      <Link
        href="/management/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All accounts
      </Link>

      {/* ── (1) Account info card ──────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border shadow-warm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="font-display text-2xl font-semibold text-foreground leading-snug">
                {account.name}
              </CardTitle>
              {account.contact_name && (
                <p className="text-sm text-muted-foreground mt-0.5">{account.contact_name}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <AccountStatusBadge status={account.status} />
                <BillingTypeBadge billingType={account.billing_type} />
              </div>
            </div>
            <EditAccountSheet account={account} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Contact details */}
          {(account.email || account.phone) && (
            <div className="flex flex-col sm:flex-row gap-3 text-sm">
              {account.email && (
                <a
                  href={`mailto:${account.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {account.email}
                </a>
              )}
              {account.phone && (
                <a
                  href={`tel:${account.phone}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {account.phone}
                </a>
              )}
            </div>
          )}

          {/* Price / rate */}
          <div className="text-sm">
            <span className="text-muted-foreground">Rate: </span>
            <span className="tabular-nums font-medium">{formatAccountPrice(account)}</span>
          </div>

          {/* Notes */}
          {account.notes && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">
              {account.notes}
            </p>
          )}

          {/* QBO link status */}
          <QboLinkStatus accountId={account.id} qboCustomerId={account.qbo_customer_id} />
        </CardContent>
      </Card>

      {/* ── (2) Properties ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Properties</h2>
          <PropertySheet accountId={account.id} />
        </div>

        {account.properties.length === 0 ? (
          <Card className="rounded-2xl border border-border shadow-warm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No properties yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {account.properties.map((property) => (
              <Card key={property.id} className="rounded-2xl border border-border shadow-warm">
                <CardContent className="p-4">
                  {/* Address + frequency + Edit trigger */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-foreground">
                        {property.address}
                      </p>
                      <div className="mt-1">
                        <FrequencyBadge frequency={property.frequency} />
                      </div>
                    </div>
                    <PropertySheet accountId={account.id} property={property} />
                  </div>

                  {/* Route group */}
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <span className="text-muted-foreground">Route group: </span>
                    <span className="font-medium text-foreground">
                      {routeGroupByPropertyId.get(property.id)?.name ?? 'Unassigned'}
                    </span>
                    <Link
                      href="/management/route-groups"
                      className="inline-flex items-center gap-1 text-xs text-[--primary] hover:underline shrink-0"
                    >
                      Manage
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Notes */}
                  {(property.crew_notes || property.access_notes || property.parking_notes) && (
                    <div className="space-y-1.5 text-sm mb-3">
                      {property.crew_notes && (
                        <p>
                          <span className="text-muted-foreground font-medium">Crew: </span>
                          {property.crew_notes}
                        </p>
                      )}
                      {property.access_notes && (
                        <p>
                          <span className="text-muted-foreground font-medium">Access: </span>
                          {property.access_notes}
                        </p>
                      )}
                      {property.parking_notes && (
                        <p>
                          <span className="text-muted-foreground font-medium">Parking: </span>
                          {property.parking_notes}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── (3) Recent visits timeline ─────────────────────────────────────── */}
      <section className="pb-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">Recent visits</h2>
        <RecentVisitsList
          visits={visits}
          account={account}
          role={role as EmployeeRole}
        />
      </section>
    </div>
  )
}
