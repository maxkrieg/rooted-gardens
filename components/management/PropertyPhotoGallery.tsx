'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { PhotoEditor } from '@/components/management/PhotoEditor'
import { PhotoUploadDropzone } from '@/components/management/PhotoUploadDropzone'
import { photoNeedsTypeBadge, photoTypeLabel } from '@/lib/utils/photos'
import type { PropertyPhotos } from '@/types/app'

interface PropertyPhotoGalleryProps {
  accountId: string
  properties: { id: string; address: string }[]
  grouped: PropertyPhotos[]
  canManage: boolean
  loadError?: boolean
}

/**
 * The account Photos tab — every photo across the account's properties, grouped
 * by property and then by kind (How-To Guide, Customer Requests, Visit Photos,
 * Visit Plan Reference).
 *
 * Photos arrive pre-signed from the server, so this component does no fetching.
 * Mutations go through Server Actions and are reflected by `router.refresh()`.
 */
export function PropertyPhotoGallery({
  accountId,
  properties,
  grouped,
  canManage,
  loadError,
}: PropertyPhotoGalleryProps) {
  // Tracked by photo id rather than position, for two reasons: a freshly
  // uploaded photo can be named before the refreshed server data has arrived
  // (the lightbox simply opens once it does), and recategorizing a photo
  // reshuffles the groups without the open photo silently becoming a different
  // one.
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null)

  // Lightbox navigation walks one property's photos, flattened across its groups
  // — staying inside the section the owner was looking at.
  const activeProperty = openPhotoId
    ? grouped.find((g) => g.groups.some((group) => group.photos.some((p) => p.id === openPhotoId)))
    : undefined
  const activePhotos = activeProperty ? activeProperty.groups.flatMap((g) => g.photos) : []
  const activeIndex = activePhotos.findIndex((p) => p.id === openPhotoId)

  if (loadError) {
    return (
      <ErrorState
        title="Photos didn't load."
        hint="Check your connection, then try again."
      />
    )
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        variant="seed"
        title="No properties yet"
        hint="Photos hang off properties, so add one on the Details tab first."
        action={
          <Button asChild variant="outline">
            <Link href={`/app/accounts/${accountId}`}>Go to Details</Link>
          </Button>
        }
        className="rounded-2xl border border-dashed border-border"
      />
    )
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <PhotoUploadDropzone
          accountId={accountId}
          properties={properties}
          onUploaded={setOpenPhotoId}
        />
      )}

      {grouped.length === 0 ? (
        <EmptyState
          variant="seed"
          title="No photos yet"
          hint="Upload how-to photos so new crew know exactly how this property should be cared for."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        grouped.map((property) => {
          return (
            <section key={property.propertyId} className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-foreground min-w-0 truncate">
                  {property.address}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {property.total} {property.total === 1 ? 'photo' : 'photos'}
                </span>
              </div>

              {property.groups.map((group) => (
                <div key={group.key} className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {group.label}
                    <span className="ml-1.5 font-normal tabular-nums">({group.photos.length})</span>
                  </h3>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {group.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setOpenPhotoId(photo.id)}
                        aria-label={photo.caption ?? `Open ${group.label} photo`}
                        className="group relative aspect-square w-full rounded-xl overflow-hidden border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {photo.url ? (
                          // Plain <img> — see the note in PhotoLightbox: signed
                          // URLs rotate hourly, so next/image buys nothing here.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.url}
                            alt={photo.caption ?? ''}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
                            Unavailable
                          </span>
                        )}

                        {photoNeedsTypeBadge(photo.type) && (
                          <Badge
                            variant="secondary"
                            className="absolute top-1 left-1 text-[10px] px-1.5 py-0"
                          >
                            {photoTypeLabel(photo.type)}
                          </Badge>
                        )}

                        {photo.caption && (
                          <span className="absolute inset-x-0 bottom-0 bg-foreground/70 text-background text-[10px] px-1.5 py-1 truncate text-left">
                            {photo.caption}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })
      )}

      {/* activeIndex is -1 in the gap between uploading a photo and its refreshed
          data arriving — the lightbox opens on its own once the photo resolves. */}
      {activeProperty && activeIndex >= 0 && (
        <PhotoLightbox
          photos={activePhotos}
          index={activeIndex}
          subtitle={activeProperty.address}
          onIndexChange={(next) => setOpenPhotoId(activePhotos[next]?.id ?? null)}
          onClose={() => setOpenPhotoId(null)}
          footer={
            canManage ? (
              // Keyed by photo id so the caption draft resets between photos.
              <PhotoEditor
                key={activePhotos[activeIndex].id}
                accountId={accountId}
                photo={activePhotos[activeIndex]}
                onClose={() => setOpenPhotoId(null)}
              />
            ) : undefined
          }
        />
      )}
    </div>
  )
}
