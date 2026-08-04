import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  AccountStatusBadge,
  BillingTypeBadge,
} from '@/components/management/badges'
import { EditAccountSheet } from '@/components/management/EditAccountSheet'
import { PropertySheet } from '@/components/management/PropertySheet'
import { PropertyPhotoGallery } from '@/components/management/PropertyPhotoGallery'
import { QboLinkStatus } from '@/components/management/QboLinkStatus'
import { FrequencyBadge } from '@/components/management/badges'
import { RecentVisitsList } from '@/components/management/RecentVisitsList'
import { EmptyState } from '@/components/states/EmptyState'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { groupPhotosByProperty, signPhotoUrls } from '@/lib/utils/photos'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import type {
  AccountWithDetails,
  EmployeeRole,
  PhotoWithUrl,
  RecentVisit,
} from '@/types/app'

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}

type AccountView = 'details' | 'photos'

function resolveView(view: string | undefined): AccountView {
  return view === 'photos' ? 'photos' : 'details'
}

export default async function AccountDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { view } = await searchParams
  const resolvedView = resolveView(view)
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

  // role mirrors app/management/schedule/page.tsx's derivation from the rg-role cookie.
  const cookieStore = await cookies()
  const role = (parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'crew') as EmployeeRole

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

      {/* ── Account identity — shared chrome above both tabs. Kept out of the
             info card so the tab strip stays in the first viewport on a phone;
             the full card is tall enough to push it below the fold. ───────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-foreground leading-snug">
            {account.name}
          </h1>
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

      {/* ── Tab strip (same pattern as the billing page) ────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-border">
        <Link
          href={`/management/accounts/${id}`}
          className={cn(
            'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'details'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Details
        </Link>
        <Link
          href={`/management/accounts/${id}?view=photos`}
          className={cn(
            'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'photos'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Photos
        </Link>
      </div>

      {resolvedView === 'photos' ? (
        <PhotosTab account={account} role={role} />
      ) : (
        <DetailsTab account={account} role={role} />
      )}
    </div>
  )
}

// ─── Details tab ──────────────────────────────────────────────────────────────

/** Today's account body: info card, properties, recent visits. Fetches its own
 *  visits + route-group data so the Photos tab doesn't pay for the 10-visit join. */
async function DetailsTab({
  account,
  role,
}: {
  account: AccountWithDetails
  role: EmployeeRole
}) {
  const supabase = await createClient()
  const propertyIds = account.properties.map((p) => p.id)

  const [visitsResult, routeGroupAssignments] = await Promise.all([
    // Full property + visit_crew(employee) join — needed to open VisitDetailSheet
    // directly from a row, same shape it already gets from the schedule grid.
    supabase
      .from('visits')
      .select('*, property:properties(*), visit_crew(*, employee:employees(*)), invoice:invoices(status, qbo_invoice_id)')
      .eq('account_id', account.id)
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

  if (visitsResult.error) console.error('[account detail] visits', visitsResult.error)
  const visits = (visitsResult.data ?? []) as RecentVisit[]

  // Decorative here — a failure just omits the badge, so log rather than surface.
  if ('error' in routeGroupAssignments && routeGroupAssignments.error) {
    console.error('[account detail] route groups', routeGroupAssignments.error)
  }
  const routeGroupByPropertyId = new Map<string, { id: string; name: string }>()
  for (const row of routeGroupAssignments.data ?? []) {
    if (row.route_groups) routeGroupByPropertyId.set(row.property_id, row.route_groups)
  }

  return (
    <div className="space-y-6">
      {/* ── (1) Account info card ──────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border shadow-warm">
        <CardContent className="space-y-4 p-5">
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

          {/* Billing address */}
          {(account.billing_address_line1 || account.billing_city) && (
            <div className="text-sm">
              <span className="text-muted-foreground">Billing address:</span>
              <div className="text-foreground mt-0.5">
                {account.billing_address_line1 && <div>{account.billing_address_line1}</div>}
                {account.billing_address_line2 && <div>{account.billing_address_line2}</div>}
                {(account.billing_city || account.billing_state || account.billing_zip) && (
                  <div>
                    {[account.billing_city, account.billing_state].filter(Boolean).join(', ')}
                    {account.billing_zip ? ` ${account.billing_zip}` : ''}
                  </div>
                )}
              </div>
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
            <CardContent className="p-0">
              <EmptyState
                variant="seed"
                title="No properties yet"
                hint="Add the addresses this account is billed for — scheduling works off properties, not accounts."
                // PropertySheet renders its own trigger.
                action={<PropertySheet accountId={account.id} />}
              />
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
          role={role}
          loadError={!!visitsResult.error}
        />
      </section>
    </div>
  )
}

// ─── Photos tab ───────────────────────────────────────────────────────────────

/**
 * Every photo across the account's properties, grouped by property then by type.
 *
 * The `photos` bucket is private, so URLs are signed here — server-side and in a
 * single batch — rather than with a client-side request per photo the way the
 * visit detail view does it. Signed URLs are denormalized onto each row so the
 * client component receives plain serializable data.
 */
async function PhotosTab({
  account,
  role,
}: {
  account: AccountWithDetails
  role: EmployeeRole
}) {
  const supabase = await createClient()
  const propertyIds = account.properties.map((p) => p.id)

  const photosResult =
    propertyIds.length > 0
      ? await supabase
          .from('photos')
          .select('*')
          .in('property_id', propertyIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null }

  if (photosResult.error) {
    console.error('[AccountPhotosTab]', photosResult.error)
  }

  const photos = photosResult.data ?? []
  const urlByPath = await signPhotoUrls(
    supabase.storage,
    photos.map((p) => p.storage_path),
  )
  const withUrls: PhotoWithUrl[] = photos.map((p) => ({
    ...p,
    url: urlByPath.get(p.storage_path) ?? null,
  }))

  return (
    <div className="pb-8">
      <PropertyPhotoGallery
        accountId={account.id}
        properties={account.properties.map((p) => ({ id: p.id, address: p.address }))}
        grouped={groupPhotosByProperty(account.properties, withUrls)}
        canManage={role === 'owner' || role === 'lead'}
        loadError={!!photosResult.error}
      />
    </div>
  )
}
