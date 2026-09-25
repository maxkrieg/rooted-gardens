'use client'

import { useSyncExternalStore } from 'react'

/** No date/time types: Android opens a picker, not a keyboard. */
const KEYBOARD_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
])

function opensKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  return KEYBOARD_INPUT_TYPES.has((el as HTMLInputElement).type)
}

let open = false
let clearTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (next === open) return
  open = next
  for (const listener of listeners) listener()
}

function handleFocusIn(e: FocusEvent) {
  clearTimeout(clearTimer)
  set(opensKeyboard(e.target))
}

function handleFocusOut() {
  // Deferred: moving between two fields fires focusout before the next
  // focusin, and closing synchronously flashes the nav back in mid-tap.
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => set(false), 150)
}

function subscribe(onChange: () => void) {
  if (listeners.size === 0) {
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    // A field can already hold focus when the first consumer mounts. React
    // re-reads the snapshot after subscribing, so this is picked up.
    open = opensKeyboard(document.activeElement)
  }
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      clearTimeout(clearTimer)
      open = false
    }
  }
}

/**
 * True while a keyboard-raising field has focus. With interactiveWidget 'resizes-content',
 * fixed bottom bars would ride on the keyboard, so they hide. Focus is the reliable signal.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  )
}
