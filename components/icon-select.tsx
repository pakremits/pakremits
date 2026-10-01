'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface IconSelectOption {
  value: string
  label: string
  /** Optional compact label used only while the option is selected. */
  selectedLabel?: string
  /** Optional trailing text in the open list, e.g. a currency code. */
  hint?: string
  icon: ReactNode
}

interface IconSelectProps {
  id: string
  label: string
  value: string
  options: readonly IconSelectOption[]
  onChange: (value: string) => void
  className?: string
  /** `hero` is the larger popover used by the search form. */
  variant?: 'default' | 'hero'
  /** Hero only: overrides the list's minimum width (full trigger width). */
  listMinWidth?: string
  /** Default only: every option bold and in full ink, for short values like "USD" / "$". */
  strongOptions?: boolean
}

/**
 * A compact visual select for options that need an icon. Native select options
 * cannot reliably render SVG content, so this preserves the expected listbox
 * keyboard controls while keeping icons decorative for screen readers.
 */
export function IconSelect({
  id,
  label,
  value,
  options,
  onChange,
  className = '',
  variant = 'default',
  listMinWidth = 'min-w-full',
  strongOptions = false,
}: IconSelectProps) {
  const hero = variant === 'hero'
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Opens upwards (`data-up` on the list) when there is not room below the
  // trigger but there is above. Measured before paint, so the list never
  // flashes in the wrong place.
  useLayoutEffect(() => {
    const root = rootRef.current?.getBoundingClientRect()
    const list = listRef.current
    if (!open || !root || !list) return
    // Only when it fits above in full: a list cut off at the top of the
    // window cannot be scrolled into view, one below the fold can.
    const needed = list.offsetHeight + 16
    list.toggleAttribute('data-up', window.innerHeight - root.bottom < needed && root.top >= needed)
  }, [open])
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Element
      if (rootRef.current?.contains(target)) return
      // A wrapper marked `data-select-area={id}` counts as part of the select:
      // it toggles the list itself, so closing here would only reopen it.
      if (target.closest?.(`[data-select-area="${id}"]`)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open, id])

  function openList() {
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setActiveIndex(index)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      if (open) event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(activeIndex)
      else openList()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + options.length) % options.length)
      return
    }

    if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    }
  }

  return (
    <div ref={rootRef} data-icon-select="" className="relative h-full min-w-0 w-full">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={`${className} flex max-w-full cursor-pointer items-center text-left ${hero ? 'gap-3' : 'gap-1.5'}`}
      >
        {selected?.icon && (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            {selected.icon}
          </span>
        )}
        {/* A short selectedLabel is for the one-row bar at lg; narrower layouts stack and have room for the full name. */}
        <span className="min-w-0 flex-1 truncate">
          {selected?.selectedLabel ? (
            <>
              <span className="lg:hidden">{selected.label}</span>
              <span className="hidden lg:inline">{selected.selectedLabel}</span>
            </>
          ) : (
            selected?.label
          )}
        </span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`shrink-0 transition-transform ${
            hero ? 'h-5 w-5 text-ink' : 'h-4 w-4 text-muted'
          } ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={
            hero
              ? // Phones: centred under the trigger and 32px wider than it, so the
                // list stays inside the card's padding instead of running off
                // the right edge the way a left-pinned, content-width list did.
                `absolute z-40 w-max ${listMinWidth} top-full mt-3 data-up:top-auto data-up:bottom-full data-up:mt-0 data-up:mb-3 max-w-[min(92vw,460px)] rounded-2xl
                 max-sm:left-1/2 max-sm:w-[calc(100%+32px)] max-sm:min-w-0 max-sm:max-w-none max-sm:-translate-x-1/2
                 flex flex-col gap-1 bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(20,32,27,.35),0_2px_8px_rgba(20,32,27,.08)]
                 dark:border dark:border-line dark:bg-header
                 before:absolute before:left-10 before:h-3 before:w-3 before:-top-1.5 data-up:before:top-auto data-up:before:-bottom-1.5
                 before:rotate-45 before:bg-surface before:content-[''] dark:before:bg-header`
              : // At least the trigger's width, wider when an option needs it, so a
                // narrow trigger (the currency switch) never truncates its list.
                `absolute z-40 max-h-80 w-max min-w-full overflow-y-auto rounded-xl border top-full mt-2 data-up:top-auto data-up:bottom-full data-up:mt-0 data-up:mb-2
                 border-line bg-surface p-1.5 dark:bg-header`
          }
        >
          {options.map((option, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActiveIndex(index)}
              // Keep focus on the trigger, but choose on click, not pointerdown:
              // closing the list mid-tap sent the tap's click through to
              // whatever lay under it (the Compare button, or the phone
              // sheet's backdrop), submitting or closing the form.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              className={
                hero
                  ? `relative flex cursor-pointer items-center gap-4 rounded-xl px-5 py-3.5
                     text-[18px] font-medium text-ink max-sm:gap-3 max-sm:px-3.5 max-sm:py-3 max-sm:text-[16px]
                     ${option.value === value || index === activeIndex ? 'bg-tint' : ''}`
                  : `flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]
                     ${index === activeIndex ? 'bg-mist text-ink dark:bg-line-2' : strongOptions ? 'text-ink' : 'text-muted'}
                     ${strongOptions ? 'font-bold' : option.value === value ? 'font-medium' : ''}`
              }
            >
              {option.icon && (
                <span className="flex shrink-0 items-center" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              {/* On a phone a long name wraps rather than losing its end. */}
              <span className={`min-w-0 flex-1 truncate ${hero ? 'max-sm:whitespace-normal' : ''}`}>
                {option.label}
              </span>
              {option.hint && (
                <span className="ml-6 shrink-0 text-[15px] font-normal text-muted max-sm:ml-3 max-sm:text-[14px]">
                  {option.hint}
                </span>
              )}
              {!hero && option.value === value && (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4 shrink-0 text-leaf"
                  aria-hidden="true"
                >
                  <path d="m3 8 3 3 7-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
