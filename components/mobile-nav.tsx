'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * The header's nav below the lg breakpoint: a full-screen panel that slides in
 * from the reading-end edge (from the right in English, mirrored in Urdu), with
 * one full-width row per link.
 *
 * A client component because a disclosure needs state. `<details>`/`<summary>`
 * would have kept the header JS-free, but every link in here is a same-page
 * hash: a hash link does not remount anything, so the drawer would stay open
 * over the section the reader just jumped to, and Escape does not close a
 * `<details>` in any browser.
 *
 * The drawer stays mounted so it can animate out; `inert` keeps it out of the
 * tab order and the accessibility tree while it is closed.
 *
 * The links are passed in rather than fetched, so this ships no message
 * catalogue of its own.
 */
export function MobileNav({
  items,
  label,
  openLabel,
  closeLabel,
  brand,
  cta,
  footer,
}: {
  items: { href: string; label: string; icon: string; current?: boolean }[]
  label: string
  openLabel: string
  closeLabel: string
  /** The logo, repeated at the top of the drawer so it keeps the bar's shape. */
  brand: ReactNode
  /** The primary action, pinned to the bottom of the drawer. */
  cta?: { href: string; label: string }
  /** Controls under the action, e.g. the theme switch. */
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function close(returnFocus = false) {
    setOpen(false)
    // Focus has to come back to the trigger, or a keyboard reader who
    // dismisses the drawer is returned to the top of the document.
    if (returnFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    closeRef.current?.focus()
    // The page behind the drawer must not scroll under the reader's thumb.
    // The lock itself is one CSS rule on <html> (see globals.css).
    const root = document.documentElement
    root.dataset.scrollLocked = ''

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      // Keep Tab inside the drawer while it is open: it is modal.
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    // The drawer closes if the viewport grows past the breakpoint, where the bar nav takes over.
    const wide = window.matchMedia('(min-width: 1024px)')
    const onWide = () => wide.matches && setOpen(false)

    document.addEventListener('keydown', onKeyDown)
    wide.addEventListener('change', onWide)
    return () => {
      delete root.dataset.scrollLocked
      document.removeEventListener('keydown', onKeyDown)
      wide.removeEventListener('change', onWide)
    }
  }, [open])

  const square =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-ink'

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={openLabel}
        className={square}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        inert={!open}
        className={`fixed inset-0 z-[61] flex flex-col bg-mist transition-transform duration-300
                    ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${
                      open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
                    }`}
      >
        {/* Same height and edges as the bar, so the logo does not jump when the panel opens. */}
        <div
          className="relative flex h-[86px] shrink-0 items-center justify-between gap-4 bg-header px-6"
        >
          <span onClick={() => close()}>{brand}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => close(true)}
            aria-label={closeLabel}
            className="-me-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink
                       transition-colors hover:bg-tint hover:text-tint-ink"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none">
              <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul>
            {items.map((item) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  // Hash links do not remount this component, so the panel
                  // has to be closed by hand on the way out.
                  onClick={() => close()}
                  className={`flex min-h-[72px] items-center gap-4 border-s-[3px] px-6 text-[18px] font-semibold
                              no-underline transition-colors ${
                                item.current
                                  ? 'border-accent bg-nav-tint text-green'
                                  : 'border-transparent text-ink hover:bg-tint hover:text-tint-ink'
                              }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 shrink-0 text-leaf"
                    aria-hidden="true"
                  >
                    <path d={item.icon} />
                  </svg>
                  <span className="flex-1">{item.label}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0 text-muted rtl:rotate-180"
                    aria-hidden="true"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {(cta || footer) && (
          <div className="shrink-0 bg-header px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            {cta && (
              <Link
                href={cta.href}
                onClick={() => close()}
                className="flex h-[52px] items-center justify-center rounded-control bg-gold text-[17px]
                           font-bold text-on-gold no-underline transition-colors hover:bg-gold-hover"
              >
                {cta.label}
              </Link>
            )}
            {footer && <div className="mt-4">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
