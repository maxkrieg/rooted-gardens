'use client'

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeTourEvents } from '@/lib/onboarding/events'
import type { TourStep } from '@/lib/onboarding/registry'
import { cn } from '@/lib/utils'

/** How long a step waits for its anchor to render before it's skipped. */
const ANCHOR_WAIT_MS = 2500
const PAD = 6

/** First element carrying this anchor that is actually laid out (both layouts stay mounted). */
export function findAnchor(anchor: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`)
  for (const node of nodes) {
    if (node.getClientRects().length > 0) return node
  }
  return null
}

interface TourRunnerProps {
  steps: TourStep[]
  isWide: boolean
  /** Shown above the title; omitted for a one-step news card. */
  label?: string
  onFinish: () => void
  onClose: () => void
}

/**
 * Spotlight + coach card over the live page. Purely visual overlay (pointer-events: none), so
 * the user can do the thing a step asks; the card itself stays clickable over Radix sheets.
 */
export function TourRunner({ steps, isWide, label, onFinish, onClose }: TourRunnerProps) {
  const [index, setIndex] = useState(0)
  // The anchor's rect for one step; `id` ties it to the step so a stale rect never shows.
  const [anchor, setAnchor] = useState<{ id: string; rect: DOMRect | null } | null>(null)
  // Steps the user actually got through. A "do it" step only counts when its action happened,
  // so steps that `require` it are skipped rather than pointing at a sheet that never opened.
  const done = useRef(new Set<string>())
  const step = steps[index]
  const waiting = !!step?.anchor && anchor?.id !== step.id
  const rect = step && anchor?.id === step.id ? anchor.rect : null

  const advance = (completed: boolean) => {
    if (step && completed) done.current.add(step.id)
    if (index >= steps.length - 1) onFinish()
    else setIndex((i) => i + 1)
  }
  const next = useEffectEvent(advance)

  // Advance "do it" steps on their event.
  useEffect(() => {
    if (!step?.advanceOn) return
    return subscribeTourEvents((event) => {
      if (event === step.advanceOn) next(true)
    })
  }, [step])

  // Resolve the anchor: skip if already satisfied, wait for it to render, then track its rect.
  // Everything runs in animation frames, never synchronously in the effect.
  useEffect(() => {
    if (!step) return
    let frame = 0
    let last: DOMRect | null = null
    let found = false
    let startedAt = 0

    const tick = (now: number) => {
      if (!startedAt) {
        startedAt = now
        if (step.requires && !step.requires.some((id) => done.current.has(id))) return next(false)
        if (step.skipIfVisible && findAnchor(step.skipIfVisible)) return next(true)
        if (!step.anchor) return
      }
      const el = findAnchor(step.anchor!)
      if (el) {
        const r = el.getBoundingClientRect()
        if (!found) {
          found = true
          if (r.top < 0 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }
        if (!last || r.top !== last.top || r.left !== last.left || r.width !== last.width || r.height !== last.height) {
          last = r
          setAnchor({ id: step.id, rect: r })
        }
      } else if (!found && now - startedAt > ANCHOR_WAIT_MS) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[onboarding] anchor "${step.anchor}" not found; skipping step "${step.id}"`)
        }
        return next(false)
      } else if (found && last) {
        // The anchor went away (a sheet closed, say). Keep the card, drop the spotlight.
        last = null
        setAnchor({ id: step.id, rect: null })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [step])

  if (!step || typeof document === 'undefined') return null
  if (waiting) return null

  return createPortal(
    <div data-tour-layer className="fixed inset-0 z-[70] pointer-events-none">
      {rect && (
        <div
          aria-hidden
          className="absolute rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(28, 26, 21, 0.45)',
          }}
        />
      )}
      <CoachCard
        key={step.id}
        step={step}
        rect={rect}
        isWide={isWide}
        label={label}
        position={steps.length > 1 ? `${index + 1} of ${steps.length}` : null}
        canGoBack={index > 0 && !steps[index - 1]?.advanceOn}
        onBack={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => advance(!step.advanceOn)}
        onClose={onClose}
        isLast={index === steps.length - 1}
      />
    </div>,
    document.body,
  )
}

function CoachCard({
  step,
  rect,
  isWide,
  label,
  position,
  canGoBack,
  onBack,
  onNext,
  onClose,
  isLast,
}: {
  step: TourStep
  rect: DOMRect | null
  isWide: boolean
  label?: string
  position: string | null
  canGoBack: boolean
  onBack: () => void
  onNext: () => void
  onClose: () => void
  isLast: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(180)

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight)
  }, [step])

  // Radix sheets dismiss on an outside pointerdown and pull focus back into themselves; stop both
  // at the card so tapping Next doesn't close the sheet the tour is pointing into.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e: Event) => e.stopPropagation()
    const events = ['pointerdown', 'mousedown', 'touchstart', 'focusin'] as const
    for (const type of events) el.addEventListener(type, stop)
    return () => {
      for (const type of events) el.removeEventListener(type, stop)
    }
  }, [])

  const style = placeCard(rect, isWide, height)
  const waitingForAction = !!step.advanceOn

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`tour-${step.id}`}
      className={cn(
        'pointer-events-auto absolute rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-warm-lg',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {(label || position) && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {[label, position].filter(Boolean).join(' · ')}
            </p>
          )}
          <h2 id={`tour-${step.id}`} className="font-display text-lg font-semibold leading-snug text-foreground">
            {step.title}
          </h2>
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          aria-label="End tour"
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/85">{step.body}</p>

      <div className="mt-4 flex items-center gap-2">
        {canGoBack && (
          <Button variant="ghost" className="h-11" onMouseDown={(e) => e.preventDefault()} onClick={onBack}>
            Back
          </Button>
        )}
        <div className="flex-1" />
        {waitingForAction ? (
          <>
            <span className="text-sm font-medium text-muted-foreground">Your turn</span>
            <Button variant="outline" className="h-11" onMouseDown={(e) => e.preventDefault()} onClick={onNext}>
              Skip
            </Button>
          </>
        ) : (
          <Button className="h-11 min-w-24" onMouseDown={(e) => e.preventDefault()} onClick={onNext}>
            {isLast ? 'Done' : 'Next'}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Phone: docked full-width at the bottom (or top, if the anchor is down there). Desktop: beside
 *  the anchor, flipping above when there's no room below. */
function placeCard(rect: DOMRect | null, isWide: boolean, height: number): React.CSSProperties {
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const vw = typeof window === 'undefined' ? 400 : window.innerWidth
  const gap = 12

  if (!isWide) {
    const bottomOffset = 72 // above the bottom nav
    const coversAnchor = rect && rect.bottom + PAD > vh - bottomOffset - height - gap
    return coversAnchor
      ? { left: gap, right: gap, top: `calc(env(safe-area-inset-top, 0px) + ${gap}px)` }
      : { left: gap, right: gap, bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffset}px)` }
  }

  const width = 360
  if (!rect) return { width, right: 24, bottom: 24 }
  const left = Math.min(Math.max(rect.left, 16), vw - width - 16)
  if (rect.bottom + PAD + gap + height < vh) return { width, left, top: rect.bottom + PAD + gap }
  if (rect.top - PAD - gap - height > 0) return { width, left, top: rect.top - PAD - gap - height }
  return { width, right: 24, bottom: 24 }
}
