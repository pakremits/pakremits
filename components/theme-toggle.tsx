'use client'

import { useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

/**
 * The header's light / dark switch.
 *
 * Reads the theme straight off <html> rather than holding its own copy, so it
 * can never disagree with what THEME_SCRIPT (or the OS) applied.
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

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the switch still works for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? toLightLabel : toDarkLabel}
      title={dark ? toLightLabel : toDarkLabel}
      className={`grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-[10px] border
                  border-line bg-surface text-ink transition-[border-color,box-shadow]
                  hover:border-accent hover:shadow-[0_0_0_2px_var(--color-accent)] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        {dark ? (
          // Sun: what the button switches to.
          <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  )
}
