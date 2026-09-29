'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { findAnchor } from '@/components/onboarding/TourRunner'
import type { NewsItem } from '@/lib/onboarding/registry'

/** A pulsing ochre dot on each due news item's anchor; tapping it opens a one-step card. */
export function NewsBeacons({
  items,
  onOpen,
}: {
  items: NewsItem[]
  onOpen: (item: NewsItem) => void
}) {
  const [rects, setRects] = useState<Record<string, DOMRect>>({})

  useEffect(() => {
    if (items.length === 0) return
    // Polled, not observed: anchors come and go with data loads and sheets, and this is a
    // handful of lookups a second.
    const update = () => {
      const next: Record<string, DOMRect> = {}
      for (const item of items) {
        const el = item.anchor ? findAnchor(item.anchor) : null
        if (el) next[item.key] = el.getBoundingClientRect()
      }
      setRects(next)
    }
    update()
    const id = window.setInterval(update, 500)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('scroll', update, true)
    }
  }, [items])

  if (items.length === 0 || typeof document === 'undefined') return null

  return createPortal(
    <>
      {items.map((item) => {
        const rect = rects[item.key]
        if (!rect) return null
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpen(item)}
            aria-label={`New: ${item.title}`}
            // 44px target around a 12px dot, centred on the anchor's top-right corner.
            className="fixed z-[45] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ top: rect.top, left: rect.right }}
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ochre)] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--ochre)] ring-2 ring-card" />
            </span>
          </button>
        )
      })}
    </>,
    document.body,
  )
}
