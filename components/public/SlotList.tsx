import { cn } from '@/lib/utils'
import { getSlot } from '@/lib/content/site'
import { EditableText } from '@/components/public/editing/EditableText'
import type { PageContent, SitePage } from '@/types/app'

/**
 * Renders a fixed run of `{prefix}_{n}_title` / `{prefix}_{n}_body` slot
 * pairs (1-indexed) as a card grid — the "philosophy" / "principles" /
 * "process" sections on the lawn, gardens, and about pages (task 9.4). Each
 * card is a plain server-rendered `<li>` wrapping two `EditableText`s, so
 * every title and body stays independently editable through the 9.2.5
 * editor — this component owns only the layout, never the copy.
 *
 * Deliberately a fixed slot count rather than a new `site_collection_items`
 * collection: these lists are part of the page's designed structure (the
 * plan is explicit that layout stays code-controlled), not an
 * owner-managed, arbitrary-length list like FAQ/jobs/team.
 */
export function SlotList({
  page,
  content,
  prefix,
  count,
  numbered = false,
  className,
}: {
  page: SitePage
  content: PageContent
  prefix: string
  count: number
  numbered?: boolean
  className?: string
}) {
  const items = Array.from({ length: count }, (_, i) => i + 1)

  return (
    <ol className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {items.map((n) => {
        const titleKey = `${prefix}_${n}_title`
        const bodyKey = `${prefix}_${n}_body`
        return (
          <li key={n} className="rounded-2xl border border-border bg-card shadow-warm p-5">
            <div className="flex items-start gap-3">
              {numbered && (
                <span className="font-display text-lg font-semibold text-primary shrink-0 tabular-nums">
                  {n}
                </span>
              )}
              <div className="min-w-0">
                <EditableText
                  page={page}
                  slotKey={titleKey}
                  kind="text"
                  value={getSlot(content, titleKey)}
                  as="p"
                  className="font-display text-base font-semibold text-foreground"
                />
                <EditableText
                  page={page}
                  slotKey={bodyKey}
                  kind="text"
                  value={getSlot(content, bodyKey)}
                  as="p"
                  multiline
                  className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
