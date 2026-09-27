'use client'

import { useSyncExternalStore } from 'react'

/**
 * How the search forms write the sending currency: its code ("USD") or its
 * symbol ("$"). A per-viewer preference, kept in localStorage and shared by
 * every form on the page, so a switch in the hero also shows on /compare.
 */
export type CurrencyDisplay = 'code' | 'symbol'

const STORAGE_KEY = 'pakremits:currency-display'
/** Same-tab listeners; the `storage` event only reaches other tabs. */
const CHANGE_EVENT = 'pakremits:currency-display'

/** This page's choice, so the switch works even where storage is blocked. */
let current: CurrencyDisplay | null = null

function read(): CurrencyDisplay {
  if (current) return current
  try {
    return localStorage.getItem(STORAGE_KEY) === 'symbol' ? 'symbol' : 'code'
  } catch {
    // Private mode or blocked storage: codes, as on the server.
    return 'code'
  }
}

function subscribe(onChange: () => void) {
  // Another tab's choice replaces this page's.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    current = null
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function setCurrencyDisplay(value: CurrencyDisplay) {
  current = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Still switches for this page (see `current`); it just is not remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** The server renders codes; a saved "symbol" takes over after hydration. */
export function useCurrencyDisplay(): CurrencyDisplay {
  return useSyncExternalStore(subscribe, read, () => 'code')
}
