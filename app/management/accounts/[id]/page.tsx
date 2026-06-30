import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Link2,
  Link2Off,
  Mail,
  Phone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AccountStatusBadge,
  BillingTypeBadge,
  VisitStatusBadge,
} from '@/components/management/badges'
import { EditAccountSheet } from '@/components/management/EditAccountSheet'
import { PropertySheet } from '@/components/management/PropertySheet'
import { ZoneList } from '@/components/management/ZoneList'
import { createClient } from '@/lib/supabase/server'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { AccountWithDetails, VisitWithZone } from '@/types/app'

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // ── 1. Account + properties + zones in one query ─────────────────────────
  const { data: accountData, error: accountError } = await supabase
    .from('accounts')
    .select('*, properties(*, service_zones(*))')
    .eq('id', id)
    .single()

  if (accountError || !accountData) {
    notFound()
  }

  // Sort zones within each property by sort_order
  const account = {
    ...accountData,
    properties: [...accountData.properties]
      .sort((a, b) => a.address.localeCompare(b.address))
      .map((p) => ({
        ...p,
        service_zones: [...p.service_zones].sort((a, b) => a.sort_order - b.sort_order),
      })),
  } as AccountWithDetails

  // ── 2. Recent visits (last 10) ────────────────────────────────────────────
  const { data: visitsData } = await supabase
    .from('visits')
    .select('*, service_zone:service_zones(name)')
    .eq('account_id', id)
    .order('week_start', { ascending: false })
    .limit(10)

  const visits = (visitsData ?? []) as VisitWithZone[]

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
          <div className="flex items-center gap-2 border-t border-border pt-3">
            {account.qbo_customer_id ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2f6e45]" />
                <span className="text-sm text-[#2f6e45] font-medium">
                  Linked to QuickBooks
                </span>
                <span className="text-sm text-muted-foreground font-mono ml-1">
                  · {account.qbo_customer_id}
                </span>
                <Link2 className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </>
            ) : (
              <>
                <Link2Off className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not linked to QuickBooks</span>
              </>
            )}
          </div>
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
                  {/* Address + Edit trigger */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-display text-base font-semibold text-foreground">
                      {property.address}
                    </p>
                    <PropertySheet accountId={account.id} property={property} />
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

                  {/* Service zones — interactive list with reorder + edit */}
                  <ZoneList property={property} zones={property.service_zones} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── (3) Recent visits timeline ─────────────────────────────────────── */}
      <section className="pb-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">Recent visits</h2>

        {visits.length === 0 ? (
          <Card className="rounded-2xl border border-border shadow-warm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-border shadow-warm overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {visits.map((visit) => (
                  <li key={visit.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Zone name */}
                      <p className="text-sm font-medium text-foreground truncate">
                        {visit.service_zone?.name ?? 'Unknown zone'}
                      </p>
                      {/* Date */}
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {visit.ended_at
                          ? format(parseISO(visit.ended_at), 'EEE MMM d, yyyy')
                          : `Week of ${format(parseISO(visit.week_start), 'EEE MMM d')}`}
                      </p>
                      {/* Service types */}
                      {visit.service_types && visit.service_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {visit.service_types.map((type) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 border-border text-muted-foreground font-normal"
                            >
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <VisitStatusBadge status={visit.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
