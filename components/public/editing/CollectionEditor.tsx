'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EditableImage } from './EditableImage'
import {
  deleteCollectionItem,
  moveCollectionItem,
  upsertCollectionItem,
} from '@/app/(public)/actions'
import type { SiteCollection, SiteCollectionItem } from '@/types/app'

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'url'
  multiline?: boolean
}

/** Every collection's editable shape, in one place — mirrors
 *  `collectionItemDataSchema` in lib/validators/site-content.ts, which is
 *  the actual source of truth these fields must stay in sync with. The
 *  first field in each list doubles as the collapsed-row title. */
const FIELD_CONFIG: Record<SiteCollection, FieldDef[]> = {
  faq: [
    { key: 'question', label: 'Question' },
    { key: 'answer', label: 'Answer', multiline: true },
  ],
  job: [
    { key: 'title', label: 'Title' },
    { key: 'location', label: 'Location' },
    { key: 'blurb', label: 'Description', multiline: true },
  ],
  team: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'bio', label: 'Bio', multiline: true },
  ],
}

/** Only `team` has a photo field, handled via EditableImage rather than a
 *  plain text input. */
const IMAGE_FIELD: Partial<Record<SiteCollection, string>> = { team: 'image_path' }

function toDraft(data: Record<string, unknown>): Record<string, string> {
  const draft: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    draft[key] = value == null ? '' : String(value)
  }
  return draft
}

function emptyDraft(collection: SiteCollection): Record<string, string> {
  const draft: Record<string, string> = {}
  for (const field of FIELD_CONFIG[collection]) draft[field.key] = ''
  const imageField = IMAGE_FIELD[collection]
  if (imageField) draft[imageField] = ''
  return draft
}

/** Empty string → null for the image field only, so "no photo" has one
 *  representation in the DB rather than drifting between '' and null. */
function buildPayload(draft: Record<string, string>, imageField?: string): Record<string, unknown> {
  if (!imageField) return draft
  return { ...draft, [imageField]: draft[imageField] || null }
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {field.label}
      </label>
      {field.multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-base"
          disabled={disabled}
        />
      ) : (
        <Input
          type={field.type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 text-base"
          disabled={disabled}
        />
      )}
    </div>
  )
}

function ItemSummary({ data, fields }: { data: Record<string, unknown>; fields: FieldDef[] }) {
  const primary = fields[0]
  const secondary = fields[1]
  const primaryValue = primary ? String(data[primary.key] ?? '') : ''
  const secondaryValue = secondary ? String(data[secondary.key] ?? '') : ''

  return (
    <div className="min-w-0">
      <p className="font-display text-base font-semibold text-foreground truncate">
        {primaryValue || 'Untitled'}
      </p>
      {secondaryValue && <p className="text-sm text-muted-foreground truncate">{secondaryValue}</p>}
    </div>
  )
}

/**
 * The expandable body of an open item card — a separate component so its
 * `draft`/`confirmingDelete` state initializes fresh from `item.data` on
 * every mount, with no reset effect needed: the parent only renders this
 * (`{open && <CollectionItemForm .../>}`) while `open` is true, so it fully
 * unmounts on close and remounts clean the next time (same fix as
 * EditableText.tsx's EditableTextForm).
 */
function CollectionItemForm({
  collection,
  item,
  fields,
  imageField,
  onClose,
  onSaved,
  onDelete,
}: {
  collection: SiteCollection
  item: SiteCollectionItem<Record<string, unknown>>
  fields: FieldDef[]
  imageField: string | undefined
  onClose: () => void
  onSaved: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(item.data))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await upsertCollectionItem({
        id: item.id,
        collection,
        data: buildPayload(draft, imageField),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Saved')
      onSaved()
    })
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={draft[field.key] ?? ''}
          onChange={(value) => setDraft((d) => ({ ...d, [field.key]: value }))}
          disabled={isPending}
        />
      ))}
      {imageField && (
        <EditableImage
          path={draft[imageField] || null}
          scope={collection}
          alt=""
          onUploaded={(path) => setDraft((d) => ({ ...d, [imageField]: path }))}
          className="h-32 w-32"
        />
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
      </div>

      <div className="border-t border-border pt-3">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground">Remove this entry?</span>
            <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={onDelete}>
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

function CollectionItemCard({
  collection,
  item,
  fields,
  imageField,
  isFirst,
  isLast,
  open,
  disabled,
  onOpen,
  onClose,
  onSaved,
  onMove,
  onDelete,
}: {
  collection: SiteCollection
  item: SiteCollectionItem<Record<string, unknown>>
  fields: FieldDef[]
  imageField: string | undefined
  isFirst: boolean
  isLast: boolean
  open: boolean
  disabled: boolean
  onOpen: () => void
  onClose: () => void
  onSaved: () => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-warm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <ItemSummary data={item.data} fields={fields} />
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isFirst}
            onClick={() => onMove('up')}
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isLast}
            onClick={() => onMove('down')}
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={open ? onClose : onOpen}
            aria-label={open ? 'Close editor' : 'Edit'}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <CollectionItemForm
          collection={collection}
          item={item}
          fields={fields}
          imageField={imageField}
          onClose={onClose}
          onSaved={onSaved}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

/**
 * Owner-only add/edit/reorder/remove for a `site_collection_items` list —
 * FAQ, jobs, or team (task 9.2.5). Only ever mounted when in edit mode: the
 * page renders `editing ? <CollectionEditor .../> : items.map(<plain
 * read-only card>)`, so this whole subtree (including EditableImage) never
 * loads for a non-owner. Only one item is open for editing at a time
 * (existing or the in-progress "Add"), matching EditableText/
 * EditableRichText's one-field-at-a-time model.
 */
export function CollectionEditor({
  collection,
  items,
}: {
  collection: SiteCollection
  items: SiteCollectionItem<Record<string, unknown>>[]
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const [newDraft, setNewDraft] = useState<Record<string, string> | null>(null)
  const [isPending, startTransition] = useTransition()

  const fields = FIELD_CONFIG[collection]
  const imageField = IMAGE_FIELD[collection]

  function startAdd() {
    setNewDraft(emptyDraft(collection))
    setOpenId('new')
  }

  function cancelAdd() {
    setNewDraft(null)
    setOpenId(null)
  }

  function handleSaveNew() {
    if (!newDraft) return
    startTransition(async () => {
      const result = await upsertCollectionItem({
        collection,
        data: buildPayload(newDraft, imageField),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Added')
      setNewDraft(null)
      setOpenId(null)
      router.refresh()
    })
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveCollectionItem({ collection, id, direction })
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCollectionItem({ collection, id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Removed')
      if (openId === id) setOpenId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <CollectionItemCard
          key={item.id}
          collection={collection}
          item={item}
          fields={fields}
          imageField={imageField}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          open={openId === item.id}
          disabled={isPending}
          onOpen={() => setOpenId(item.id)}
          onClose={() => setOpenId(null)}
          onSaved={() => {
            setOpenId(null)
            router.refresh()
          }}
          onMove={(direction) => handleMove(item.id, direction)}
          onDelete={() => handleDelete(item.id)}
        />
      ))}

      {openId === 'new' && newDraft ? (
        <div className="space-y-3 rounded-2xl border border-[var(--clay)] bg-card shadow-warm p-4">
          {fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={newDraft[field.key] ?? ''}
              onChange={(value) => setNewDraft((d) => (d ? { ...d, [field.key]: value } : d))}
              disabled={isPending}
            />
          ))}
          {imageField && (
            <EditableImage
              path={newDraft[imageField] || null}
              scope={collection}
              alt=""
              onUploaded={(path) => setNewDraft((d) => (d ? { ...d, [imageField]: path } : d))}
              className="h-32 w-32"
            />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={handleSaveNew}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={cancelAdd}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={startAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      )}
    </div>
  )
}
