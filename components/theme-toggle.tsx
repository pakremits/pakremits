'use client'

import { useState, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

/**
 * The header's light / dark switch.
 *
 * Reads the theme straight off <html> rather than holding its own copy, so it
 * can never disagree with what THEME_SCRIPT (or the OS) applied.
 *
 * Switching cross-fades the page's colours (`theme-fade` in globals.css)
 * while the icon turns from moon to sun or back. Reduced motion gets the
 * instant swap.
 */

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

// Unknown on the server; the button renders its light-mode face until hydrated.
const serverTheme = (): Theme | null => null

/** Matches the transition length in the `theme-fade` rule. */
const FADE_MS = 360

export function ThemeToggle({
  toDarkLabel,
  toLightLabel,
  className = '',
}: {
  toDarkLabel: string
  toLightLabel: string
  className?: string
}) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme)
  const dark = theme === 'dark'
  // The icon only animates once the reader has pressed the button, so a page
  // that loads in dark mode does not spin its icon on hydration.
  const [touched, setTouched] = useState(false)

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark'
    const root = document.documentElement
    setTouched(true)

    const fade = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (fade) root.classList.add('theme-fade')
    root.dataset.theme = next
    if (fade) window.setTimeout(() => root.classList.remove('theme-fade'), FADE_MS)

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the switch still works for this page.
    }
  }

  const icon = `theme-icon absolute inset-0 h-5 w-5 ${
    touched ? 'transition-[rotate,scale,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none' : ''
  }`
  const shown = 'rotate-0 scale-100 opacity-100'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? toLightLabel : toDarkLabel}
      title={dark ? toLightLabel : toDarkLabel}
      className={`grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-[10px]
                  bg-mist text-ink transition-shadow dark:bg-surface
                  hover:shadow-[0_0_0_2px_var(--color-accent)] ${className}`}
    >
      <span className="relative h-5 w-5" aria-hidden="true">
        {/* Sun: what the button switches to in dark mode. Turns in from the left. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${icon} ${dark ? shown : '-rotate-90 scale-50 opacity-0'}`}
        >
          <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        </svg>
        {/* Moon: what it switches to in light mode. Swings in from the right. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${icon} ${dark ? 'rotate-90 scale-50 opacity-0' : shown}`}
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      </span>
    </button>
  )
}
