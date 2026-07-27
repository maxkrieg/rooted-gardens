'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Images, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  // Lightbox navigation walks one property's photos, flattened across its groups
  // — staying inside the section the owner was looking at.
  const [active, setActive] = useState<{ propertyId: string; index: number } | null>(null)

  const activeProperty = active ? grouped.find((g) => g.propertyId === active.propertyId) : undefined
  const activePhotos = activeProperty ? activeProperty.groups.flatMap((g) => g.photos) : []

  if (loadError) {
    return (
      <EmptyState
        icon={<Images className="h-10 w-10 text-muted-foreground/30 mb-4" />}
        title="Could not load photos."
        hint="Something went wrong reaching the photo library. Try refreshing the page."
      />
    )
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={<MapPin className="h-10 w-10 text-muted-foreground/30 mb-4" />}
        title="No properties yet."
        hint="Add a property on the Details tab before uploading photos."
        action={
          <Link
            href={`/management/accounts/${accountId}`}
            className="text-sm text-[--primary] hover:underline mt-3"
          >
            Go to Details
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {canManage && <PhotoUploadDropzone accountId={accountId} properties={properties} />}

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Images className="h-10 w-10 text-muted-foreground/30 mb-4" />}
          title="No photos yet."
          hint="Upload how-to photos so new crew know exactly how this property should be cared for."
        />
      ) : (
        grouped.map((property) => {
          // Indices are into the property-wide flattened list, so lightbox
          // navigation can cross group boundaries.
          const flattened = property.groups.flatMap((g) => g.photos)

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
                        onClick={() =>
                          setActive({
                            propertyId: property.propertyId,
                            index: flattened.findIndex((p) => p.id === photo.id),
                          })
                        }
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

      {active && activeProperty && (
        <PhotoLightbox
          photos={activePhotos}
          index={active.index}
          subtitle={activeProperty.address}
          onIndexChange={(next) => setActive({ ...active, index: next })}
          onClose={() => setActive(null)}
          footer={
            canManage && activePhotos[active.index] ? (
              // Keyed by photo id so the caption draft resets between photos.
              <PhotoEditor
                key={activePhotos[active.index].id}
                accountId={accountId}
                photo={activePhotos[active.index]}
                onClose={() => setActive(null)}
              />
            ) : undefined
          }
        />
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl">
      {icon}
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>
      {action}
    </div>
  )
}
