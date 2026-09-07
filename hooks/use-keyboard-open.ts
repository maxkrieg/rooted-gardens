'use client'

import { useSyncExternalStore } from 'react'

/**
 * `date`/`time`/`month`/`week` are deliberately absent — Android opens a picker
 * for those, not a keyboard, so hiding the nav for them just makes the bar
 * flicker.
 */
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
 * True while a field that raises the on-screen keyboard holds focus.
 *
 * Paired with `interactiveWidget: 'resizes-content'` (app/layout.tsx): that key
 * makes Android shrink the *layout* viewport for the keyboard, which is what
 * un-strands every `bottom-0` fixed element — but it also floats the bottom nav
 * directly onto the keyboard, eating 56px and swallowing taps on its top row.
 * Consumers hide themselves while this is true.
 *
 * Focus, not `visualViewport` geometry: the viewport tells you the keyboard's
 * size in one resize mode and nothing in the other, whereas focus is the actual
 * signal and reads the same on both platforms.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  )
}
