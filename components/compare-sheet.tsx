'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CompareSearch, type SearchCorridorOption } from '@/components/compare-search'
import { CountryFlag, type PayoutOption } from '@/components/select-icons'

/**
 * The /compare search on phones: a one-line summary of the current search
 * ("1,000 USD → PKR") that opens the full search form in a full-screen sheet.
 *
 * On a phone the one-row bar stacks into five fields and pushes the results
 * below the fold; the summary gives the list the first screen back. The sheet
 * is a native <dialog> like the rate alert one, so it gets the same focus trap
 * and Escape behaviour, but it opens and closes instantly: no slide
 * (`screen-sheet` in globals.css). The form
 * inside is the ordinary CompareSearch: Compare navigates as it does anywhere,
 * and the sheet closes on the click so the results skeleton shows.
 */

/** Its own ids: the one-row form is also in the page (hidden) on phones. */
const SHEET_IDS = { from: 'sheet-from', method: 'sheet-method', amount: 'sheet-amount' }

export function CompareSheet({
  corridors,
  corridor,
  payout,
  amount,
  className = '',
}: {
  corridors: SearchCorridorOption[]
  corridor: string
  payout: PayoutOption
  amount: number
  className?: string
}) {
  const t = useTranslations('panel')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  const current = corridors.find((option) => option.slug === corridor) ?? corridors[0]
  const sendLabel = `${amount.toLocaleString('en-GB')} ${current?.currency ?? ''}`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  // The sheet goes as soon as Compare starts, so the results skeleton
  // underneath is what the wait looks like. The navigation belongs to the
  // page, so unmounting the form here does not cut it short.
  const onPendingChange = useCallback((pending: boolean) => {
    if (pending) close()
  }, [close])

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('editSearch', { summary: `${sendLabel} → PKR` })}
        className="flex h-16 w-full cursor-pointer items-center gap-2.5 rounded-[16px] border border-line bg-surface px-5
                   text-start text-[17px] font-semibold text-ink tabular-nums
                   max-[339px]:gap-2 max-[339px]:px-4 max-[339px]:text-[16px]
                   shadow-[0_6px_20px_-10px_rgba(20,32,27,.12),0_1px_2px_rgba(20,32,27,.04)]
                   transition-[border-color,box-shadow] hover:border-accent
                   hover:shadow-[0_0_0_2px_var(--color-accent)]"
      >
        {/* One line, always. On narrow phones the Pakistan flag goes first
            ("PKR" says the same), then the text tightens; only past that does
            the amount truncate. The button's label carries the full text. */}
        {current && (
          <span className="shrink-0">
            <CountryFlag countryCode={current.countryCode} />
          </span>
        )}
        <span dir="ltr" className="min-w-0 truncate">
          {sendLabel}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0 text-leaf rtl:rotate-180"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <span className="shrink-0 max-[379px]:hidden">
          <CountryFlag countryCode="PK" />
        </span>
        <span className="shrink-0">PKR</span>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="ms-auto h-5 w-5 shrink-0 text-ink"
          aria-hidden="true"
        >
          <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.33-2.33a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="compare-sheet-title"
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="screen-sheet m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[560px] overflow-y-auto
                   rounded-[20px] bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgba(20,32,27,.35)]
                   backdrop:bg-[rgba(20,32,27,.45)]"
      >
        {open && (
          <div className="pb-2 sm:pt-3">
            {/* Sized like the site header, so the page reads as the bar with a form under it. */}
            <div className="flex min-h-[72px] items-center justify-between gap-4 px-6 py-3 sm:min-h-0 sm:py-0">
              <h2 id="compare-sheet-title" className="text-[21px] leading-[1.2] font-bold tracking-[-0.02em]">
                {t('heading')}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={t('closeSearch')}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] border-2
                           border-line text-ink transition-[border-color,box-shadow] hover:border-accent"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <CompareSearch
              corridors={corridors}
              initialCorridor={corridor}
              initialPayout={payout}
              initialAmount={amount}
              ids={SHEET_IDS}
              onPendingChange={onPendingChange}
              bare
              className="border-t-[3px] border-line sm:mt-2"
            />
          </div>
        )}
      </dialog>
    </div>
  )
}
