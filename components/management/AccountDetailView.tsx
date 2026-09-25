'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AccountStatusBadge,
  BillingTypeBadge,
  CadenceBadge,
  CadenceSummary,
} from '@/components/management/badges'
import { EditAccountSheet } from '@/components/management/EditAccountSheet'
import { ConfirmDialog } from '@/components/management/ConfirmDialog'
import { archiveAccount } from '@/app/app/(padded)/accounts/actions'
import { archiveProperty } from '@/app/app/(padded)/accounts/property-actions'
import { PropertySheet } from '@/components/management/PropertySheet'
import { PropertyPhotoGallery } from '@/components/management/PropertyPhotoGallery'
import { QboLinkStatus } from '@/components/management/QboLinkStatus'
import { RecentVisitsList } from '@/components/management/RecentVisitsList'
import { CachedNotice } from '@/components/states/CachedNotice'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import {
  useAccountDetail,
  useAccountPhotos,
  useRefreshAccounts,
  useSignedPhotoUrls,
} from '@/hooks/useAccounts'
import { usePropertyLastVisit } from '@/hooks/usePropertyLastVisit'
import { useIsHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { groupPhotosByProperty } from '@/lib/utils/photos'
import type { AccountDetail } from '@/lib/accounts/fetch'
import { useCan } from '@/components/app/RoleProvider'
import { PropertyRoutePicker } from '@/components/management/PropertyRoutePicker'
import type { PhotoWithUrl } from '@/types/app'
import { getCachedPhoto, isCacheablePhoto, putCachedPhoto } from '@/lib/offline/photo-blobs'

type AccountView = 'details' | 'photos'

interface AccountDetailViewProps {
  accountId: string
  initialView: AccountView
}

/**
 * Client-first account detail — the "standing in the driveway" lookup, so it has
 * to render from cache. Tabs are client state rather than `?view=` links, which
 * were an RSC round-trip per switch.
 */
export function AccountDetailView({ accountId, initialView }: AccountDetailViewProps) {
  const { archive: canArchive } = useCan()
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
        href="/app/accounts"
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
          {canArchive && (
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
        <PhotosTab detail={detail} />
      ) : (
        <DetailsTab detail={detail} />
      )}
    </div>
  )
}

function DetailsTab({ detail }: { detail: AccountDetail }) {
  const { archive: canArchive, editRoutes } = useCan()
  const { account, visits, routeGroupByPropertyId, visitsFailed } = detail
  const { data: lastVisitByProperty } = usePropertyLastVisit()

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
                          <CadenceBadge
                            property={property}
                            lastVisitOn={lastVisitByProperty?.[property.id] ?? null}
                            showDays
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <PropertySheet accountId={account.id} property={property} />
                        {canArchive && (
                          <DeletePropertyButton
                            propertyId={property.id}
                            accountId={account.id}
                            address={property.address}
                          />
                        )}
                      </div>
                    </div>

                    {/* Unrouted means this property is skipped on the schedule
                        entirely, so it gets the clay "needs attention" treatment.
                        The picker is inline: this used to link to /app/routes
                        carrying no property context, so you arrived at a list of
                        every route with no memory of what you came to route. */}
                    <CadenceSummary
                      property={property}
                      lastVisitOn={lastVisitByProperty?.[property.id] ?? null}
                      className="mb-3"
                    />

                    <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
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
                      {editRoutes && (
                        <PropertyRoutePicker
                          propertyId={property.id}
                          propertyAddress={property.address}
                          currentRouteGroupId={routeGroup?.id ?? null}
                        />
                      )}
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
        <RecentVisitsList visits={visits} account={account} loadError={visitsFailed} />
      </section>
    </div>
  )
}

function PhotosTab({ detail }: { detail: AccountDetail }) {
  const { editAccounts } = useCan()
  const { account } = detail
  const propertyIds = account.properties.map((p) => p.id)
  const { data: photos = [], isError } = useAccountPhotos(account.id, propertyIds)
  const { data: urlByPath } = useSignedPhotoUrls(photos.map((p) => p.storage_path))
  // How-to and customer-request photos get their bytes cached on the device, so
  // a gate-code photo still loads in a dead zone.
  const cachedUrlByPath = useCachedPhotoUrls(photos, urlByPath)

  const withUrls: PhotoWithUrl[] = photos.map((p) => ({
    ...p,
    url: urlByPath?.[p.storage_path] ?? cachedUrlByPath[p.storage_path] ?? null,
  }))

  return (
    <div className="pb-8">
      <PropertyPhotoGallery
        accountId={account.id}
        properties={account.properties.map((p) => ({ id: p.id, address: p.address }))}
        grouped={groupPhotosByProperty(account.properties, withUrls)}
        canManage={editAccounts}
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

type CacheablePhoto = { storage_path: string; type: string | null }

/**
 * Object URLs for photos whose bytes are cached on the device, plus a warm pass
 * that caches new ones while a signed URL is available.
 *
 * Signed URLs win when present — they cost nothing and avoid holding blobs in
 * memory. These are the fallback that makes a gate-code photo readable offline.
 */
function useCachedPhotoUrls(
  photos: CacheablePhoto[],
  // Pass React Query's `data` straight through, undefined and all: its identity
  // is stable between renders, whereas a `?? {}` default at the call site would
  // be a fresh object every render and re-run the warm pass forever.
  signedUrls: Record<string, string> | undefined,
): Record<string, string> {
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  // Source of truth for what we've created, so a re-run can't mint a second URL
  // for the same blob and leak the first.
  const createdRef = useRef(new Map<string, string>())
  const cacheablePaths = photos
    .filter((p) => isCacheablePhoto(p.type))
    .map((p) => p.storage_path)
    .sort()
    .join(',')
  useEffect(() => {
    let cancelled = false
    const paths = cacheablePaths ? cacheablePaths.split(',') : []

    async function run() {
      for (const path of paths) {
        if (cancelled) return
        if (createdRef.current.has(path)) continue

        let blob = await getCachedPhoto(path)

        // Not cached yet — pull the bytes while a signed URL exists.
        if (!blob) {
          const signed = signedUrls?.[path]
          if (!signed) continue
          try {
            const res = await fetch(signed)
            if (!res.ok) continue
            blob = await res.blob()
            await putCachedPhoto(path, blob)
          } catch {
            // Offline, or the URL expired. Nothing to cache and nothing to say.
            continue
          }
        }
        if (cancelled || createdRef.current.has(path)) continue

        const url = URL.createObjectURL(blob)
        createdRef.current.set(path, url)
        setObjectUrls((prev) => ({ ...prev, [path]: url }))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [cacheablePaths, signedUrls])

  useEffect(() => {
    const created = createdRef.current
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url)
      created.clear()
    }
  }, [])

  return objectUrls
}

// Archive (soft delete) keeps visits, invoices and photos. Owner-only: callers gate on
// role, and the enforce_owner_only_archive trigger enforces it.
function DeleteButton({
  noun,
  description,
  onDelete,
}: {
  noun: 'account' | 'property'
  description: React.ReactNode
  onDelete: () => Promise<{ error?: string }>
}) {
  const [pending, startTransition] = useTransition()

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label={`Delete ${noun}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
      title={`Delete this ${noun}?`}
      description={description}
      confirmLabel={`Delete ${noun}`}
      pending={pending}
      onConfirm={() =>
        startTransition(async () => {
          const res = await onDelete()
          if (res.error) toast.error(`Could not delete ${noun}`, { description: res.error })
        })
      }
    />
  )
}

function DeleteAccountButton({
  accountId,
  accountName,
  propertyCount,
}: {
  accountId: string
  accountName: string
  propertyCount: number
}) {
  const router = useRouter()
  const refreshAccounts = useRefreshAccounts()

  return (
    <DeleteButton
      noun="account"
      onDelete={async () => {
        const res = await archiveAccount(accountId)
        if (res.error) return res
        toast.success(`Deleted ${accountName}`)
        refreshAccounts(accountId)
        router.push('/app/accounts')
        return {}
      }}
      description={
        <>
          <span className="font-medium text-foreground">{accountName}</span> will be removed from
          accounts, the schedule, and route groups
          {propertyCount > 0 && (
            <>
              , along with{' '}
              <span className="font-medium text-foreground">
                {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
              </span>
            </>
          )}
          . Completed visits and invoices are kept for your records, and any work that hasn&apos;t
          been invoiced yet stays in the billing queue.
        </>
      }
    />
  )
}

function DeletePropertyButton({
  propertyId,
  accountId,
  address,
}: {
  propertyId: string
  accountId: string
  address: string
}) {
  const refreshAccounts = useRefreshAccounts()

  return (
    <DeleteButton
      noun="property"
      onDelete={async () => {
        const res = await archiveProperty(propertyId, accountId)
        if (res.error) return res
        toast.success('Property deleted')
        refreshAccounts(accountId)
        return {}
      }}
      description={
        <>
          <span className="font-medium text-foreground">{address}</span> will be removed from the
          schedule and its route group. Past visits and photos are kept for your records, and any
          work that hasn&apos;t been invoiced yet stays in the billing queue.
        </>
      }
    />
  )
}
