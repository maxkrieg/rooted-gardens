'use client'

import type { SiteCollection, SiteCollectionItem } from '@/types/app'
import { CollectionEditor } from './CollectionEditor'
import { useEditMode } from './EditModeProvider'

/**
 * Switches between a page's read-only collection (`children`) and CollectionEditor. A client
 * component because it needs useEditMode().
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
