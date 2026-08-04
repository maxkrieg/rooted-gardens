'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsStandalone } from '@/hooks/use-media-query'

const DISMISSED_KEY = 'rg-install-dismissed'

/**
 * The `beforeinstallprompt` event, which TypeScript's DOM lib doesn't ship
 * because it isn't in any standard — it's Chromium-only.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iOS Safari never fires `beforeinstallprompt`; installing is a manual gesture. */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

const noopSubscribe = () => () => {}

/**
 * `useSyncExternalStore`, not state-in-an-effect: the UA string can't be read
 * during SSR, but unlike `dismissed` below, computing it eagerly on the first
 * client render would flip which of the two early returns fires — server
 * renders null, client would render the bar — a real hydration mismatch.
 * `useSyncExternalStore` is the sanctioned escape hatch for a value that's
 * allowed to differ between the server and client snapshots.
 */
function useIsIosSafari(): boolean {
  return useSyncExternalStore(noopSubscribe, isIosSafari, () => false)
}

/**
 * Nudges crew to install the PWA to their home screen — the crew side is
 * phone-only and offline-tolerant, and both work better installed.
 *
 * Two paths, because the platforms differ: Chromium fires an event we can turn
 * into a one-tap install, while iOS Safari requires the user to go through the
 * Share sheet, so all we can do is tell them how. Dismissal sticks.
 */
export function InstallPrompt() {
  const isStandalone = useIsStandalone()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const showIosHint = useIsIosSafari()
  // Lazy initializer, not a setState-in-effect: `deferred` and `showIosHint`
  // both still default to their SSR values on this same first client render,
  // so the two early returns below already yield `null` regardless of what
  // this reads — there's no window where a stale `dismissed` could show
  // through, so reading localStorage here can't desync hydration.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(DISMISSED_KEY) === '1',
  )

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Chromium fires this after a successful install; clear the bar immediately
    // rather than waiting for the display-mode media query to flip.
    const onInstalled = () => setDeferred(null)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  if (isStandalone || dismissed) return null
  if (!deferred && !showIosHint) return null

  return (
    <div
      className="flex items-start gap-3 border-b px-4 py-3"
      style={{
        backgroundColor: 'var(--accent)',
        color: 'var(--accent-foreground)',
        borderBottomColor: 'var(--border)',
      }}
    >
      <div className="min-w-0 flex-1 text-sm font-sans">
        <p className="font-medium">Add Rooted to your home screen</p>
        {deferred ? (
          <p className="mt-0.5 text-xs opacity-80">
            Opens full screen and keeps working without signal.
          </p>
        ) : (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs opacity-80">
            Tap
            <Share className="inline h-3.5 w-3.5" aria-label="Share" />
            then
            <SquarePlus className="inline h-3.5 w-3.5" aria-hidden />
            <span className="font-medium">Add to Home Screen</span>
          </p>
        )}
      </div>

      {deferred && (
        <Button size="sm" onClick={install} className="shrink-0">
          Install
        </Button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
