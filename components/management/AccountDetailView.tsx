'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Mail, Phone, TriangleAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  AccountStatusBadge,
  BillingTypeBadge,
  FrequencyBadge,
} from '@/components/management/badges'
import { EditAccountSheet } from '@/components/management/EditAccountSheet'
import { DeleteAccountButton } from '@/components/management/DeleteAccountButton'
import { DeletePropertyButton } from '@/components/management/DeletePropertyButton'
import { PropertySheet } from '@/components/management/PropertySheet'
import { PropertyPhotoGallery } from '@/components/management/PropertyPhotoGallery'
import { QboLinkStatus } from '@/components/management/QboLinkStatus'
import { RecentVisitsList } from '@/components/management/RecentVisitsList'
import { CachedNotice } from '@/components/states/CachedNotice'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { useAccountDetail, useAccountPhotos, useSignedPhotoUrls } from '@/hooks/useAccounts'
import { useIsHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { groupPhotosByProperty } from '@/lib/utils/photos'
import type { AccountDetail } from '@/lib/accounts/fetch'
import type { EmployeeRole, PhotoWithUrl } from '@/types/app'

type AccountView = 'details' | 'photos'

interface AccountDetailViewProps {
  accountId: string
  initialView: AccountView
  role: EmployeeRole
}

/**
 * Client-first account detail — the "standing in the driveway" lookup, so it has
 * to render from cache. Tabs are client state rather than `?view=` links, which
 * were an RSC round-trip per switch.
 */
export function AccountDetailView({ accountId, initialView, role }: AccountDetailViewProps) {
  const hydrated = useIsHydrated()
  const [view, setView] = useState<AccountView>(initialView)
  const { detail, isLoading, isError, isStale, hasData } = useAccountDetail(accountId)

  useEffect(() => {
    const url = view === 'photos' ? `?view=photos` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [view])

  if (!hydrated || (isLoading && !hasData)) return <AccountDetailSkeleton />
  if (isError && !hasData) {
    return <ErrorState title="This account didn't load." hint="Check your connection, then try again." />
  }
  if (!detail) {
    return (
      <ErrorState
        title="That account no longer exists."
        hint="It may have been archived. Head back to the account list."
      />
    )
  }

  const { account } = detail

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/management/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All accounts
      </Link>

      {isStale && <CachedNotice />}

      {/* Identity sits above the info card so the tab strip stays in the first
          viewport on a phone. */}
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
        <div className="flex items-center gap-1 shrink-0">
          <EditAccountSheet account={account} />
          {/* Deleting an account takes its properties with it, so it's owner-only —
              narrower than editing, which leads can do. */}
          {role === 'owner' && (
            <DeleteAccountButton
              accountId={account.id}
              accountName={account.name}
              propertyCount={account.properties.length}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border">
        {(['details', 'photos'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setView(tab)}
            className={cn(
              'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              view === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {view === 'photos' ? (
        <PhotosTab detail={detail} role={role} />
      ) : (
        <DetailsTab detail={detail} role={role} />
      )}
    </div>
  )
}

function DetailsTab({ detail, role }: { detail: AccountDetail; role: EmployeeRole }) {
  const { account, visits, routeGroupByPropertyId, visitsFailed } = detail

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border shadow-warm">
        <CardContent className="space-y-4 p-5">
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

          <div className="text-sm">
            <span className="text-muted-foreground">Rate: </span>
            <span className="tabular-nums font-medium">{formatAccountPrice(account)}</span>
          </div>

          {account.notes && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">
              {account.notes}
            </p>
          )}

          <QboLinkStatus accountId={account.id} qboCustomerId={account.qbo_customer_id} />
        </CardContent>
      </Card>

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
                action={<PropertySheet accountId={account.id} />}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {account.properties.map((property) => {
              const routeGroup = routeGroupByPropertyId[property.id]
              return (
                <Card key={property.id} className="rounded-2xl border border-border shadow-warm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold text-foreground">
                          {property.address}
                        </p>
                        <div className="mt-1">
                          <FrequencyBadge frequency={property.frequency} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <PropertySheet accountId={account.id} property={property} />
                        {role === 'owner' && (
                          <DeletePropertyButton
                            propertyId={property.id}
                            accountId={account.id}
                            address={property.address}
                          />
                        )}
                      </div>
                    </div>

                    {/* Unrouted means this property is skipped on the schedule
                        entirely, so it gets the clay "needs attention" treatment. */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      {!routeGroup && (
                        <TriangleAlert className="h-3.5 w-3.5 text-[var(--clay)] shrink-0" />
                      )}
                      <span className="text-muted-foreground">Route group: </span>
                      <span
                        className={cn(
                          'font-medium',
                          routeGroup ? 'text-foreground' : 'text-[var(--clay)]',
                        )}
                      >
                        {routeGroup?.name ?? 'Not on a route'}
                      </span>
                      <Link
                        href="/management/routes"
                        className="inline-flex items-center gap-1 text-xs text-[--primary] hover:underline shrink-0"
                      >
                        {routeGroup ? 'Manage' : 'Put on a route'}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

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
              )
            })}
          </div>
        )}
      </section>

      <section className="pb-8">
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">Recent visits</h2>
        <RecentVisitsList visits={visits} account={account} role={role} loadError={visitsFailed} />
      </section>
    </div>
  )
}

function PhotosTab({ detail, role }: { detail: AccountDetail; role: EmployeeRole }) {
  const { account } = detail
  const propertyIds = account.properties.map((p) => p.id)
  const { data: photos = [], isError } = useAccountPhotos(account.id, propertyIds)
  const { data: urlByPath = {} } = useSignedPhotoUrls(photos.map((p) => p.storage_path))

  const withUrls: PhotoWithUrl[] = photos.map((p) => ({
    ...p,
    url: urlByPath[p.storage_path] ?? null,
  }))

  return (
    <div className="pb-8">
      <PropertyPhotoGallery
        accountId={account.id}
        properties={account.properties.map((p) => ({ id: p.id, address: p.address }))}
        grouped={groupPhotosByProperty(account.properties, withUrls)}
        canManage={role === 'owner' || role === 'lead'}
        loadError={isError}
      />
    </div>
  )
}

function AccountDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeaderSkeleton />
      <CardListSkeleton rows={3} height="h-32" />
    </div>
  )
}
