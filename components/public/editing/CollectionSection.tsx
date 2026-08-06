'use client'

import type { SiteCollection, SiteCollectionItem } from '@/types/app'
import { CollectionEditor } from './CollectionEditor'
import { useEditMode } from './EditModeProvider'

/**
 * Switches between a page's own read-only rendering of a collection (FAQ /
 * job / team — passed as `children`, computed server-side exactly as before
 * task 9.2.5, each page keeping its own card layout and empty-state copy)
 * and the owner-only `CollectionEditor`. A separate small client component
 * because that decision needs `useEditMode()`, which the pages themselves
 * (async Server Components) can't call directly.
 */
export function CollectionSection({
  collection,
  items,
  children,
}: {
  collection: SiteCollection
  items: SiteCollectionItem<Record<string, unknown>>[]
  children: React.ReactNode
}) {
  const { canEdit, editing } = useEditMode()

  if (canEdit && editing) {
    return <CollectionEditor collection={collection} items={items} />
  }

  return <>{children}</>
}
