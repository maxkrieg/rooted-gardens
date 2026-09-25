'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsStandalone } from '@/hooks/use-media-query'

const DISMISSED_KEY = 'rg-install-dismissed'


/** Chromium-only event, missing from TypeScript's DOM lib. */
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
 * useSyncExternalStore: the UA differs between server and client snapshots, and reading it
 * eagerly would cause a hydration mismatch.
 */
function useIsIosSafari(): boolean {
  return useSyncExternalStore(noopSubscribe, isIosSafari, () => false)
}

/**
 * Prompts installing the PWA: one-tap on Chromium, Share-sheet instructions on iOS. Dismissal
 * sticks.
 */
export function InstallPrompt({ dismissKey = DISMISSED_KEY }: { dismissKey?: string } = {}) {
  const isStandalone = useIsStandalone()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const showIosHint = useIsIosSafari()
  // Safe as a lazy initializer: the early returns below yield null on first render regardless.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(dismissKey) === '1',
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
    window.localStorage.setItem(dismissKey, '1')
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
