'use client'

import { useEffect, useRef } from 'react'

/**
 * Pins its children (the route/account/crew/status filters + week nav) to the
 * top of the viewport as the page scrolls, so a long route-group list never
 * loses that context. Measures its own rendered height and publishes it as
 * `--schedule-sticky-h` on the document root — ScheduleGrid's <thead> reads
 * that var to sit flush beneath this bar instead of overlapping it. A ref +
 * ResizeObserver (rather than a hardcoded offset) keeps the two in sync
 * across breakpoints/zoom/font-size, where this bar's height isn't fixed.
 */
export function ScheduleStickyBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => {
      document.documentElement.style.setProperty('--schedule-sticky-h', `${el.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--schedule-sticky-h')
    }
  }, [])

  return (
    <div
      ref={ref}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:top-0 z-40 bg-background pb-3 mb-3"
    >
      {children}
    </div>
  )
}
