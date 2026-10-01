'use client'

import { useEffect, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useArrivalNavigation, useCompareNavigation } from '@/components/compare-navigation'
import { IconSelect, type IconSelectOption } from '@/components/icon-select'
import { CountryFlag, PayoutMethodIcon, type PayoutOption } from '@/components/select-icons'
import { type Locale, localePath } from '@/i18n/routing'
import { PAYOUT_OPTIONS } from '@/lib/payout'
import { CURRENCY_SYMBOLS } from '@/lib/corridors'
import { setCurrencyDisplay, useCurrencyDisplay, type CurrencyDisplay } from '@/lib/currency-display'
import type { SendCurrency } from '@/lib/db/schema'
import { detectVisitorCorridor } from '@/lib/visitor-corridor'

/**
 * The search form in the home hero and at the top of /compare.
 *
 * By default it does not fetch anything itself: Compare navigates to /compare
 * with the selection in the query string, and that page renders the ranked
 * results on the server. With `onCompare` it is the live ComparePanel's
 * controls instead: Compare hands the selection back and nothing navigates.
 */

export interface SearchSelection {
  corridor: string
  payout: PayoutOption
  /** Raw field text; the owner decides whether it is a usable amount. */
  amountText: string
}

export interface SearchCorridorOption {
  slug: string
  countryCode: string
  countryName: string
  currency: string
  /** The corridor's standard amount, used when switching into it. */
  defaultAmount: number
}

interface Props {
  corridors: SearchCorridorOption[]
  initialCorridor?: string
  initialPayout?: PayoutOption
  initialAmount?: number
  className?: string
  /** `row` puts every control on one line (desktop), as on /compare. */
  layout?: 'stacked' | 'row'
  /** Live mode: Compare calls this with the selection instead of navigating. */
  onCompare?: (selection: SearchSelection) => void
  /** Live mode: the owner's request is in flight, so Compare shows progress. */
  busy?: boolean
  /** Told the moment a different sending country is picked. */
  onCorridorChange?: (slug: string) => void
  /** Control ids, for pages that link or test against the old panel's ids. */
  ids?: { from: string; method: string; amount: string }
  /** No card of its own (radius, surface, shadow), for use inside a sheet. */
  bare?: boolean
  /** Told when a Compare navigation starts and when its page has rendered. */
  onPendingChange?: (pending: boolean) => void
  /**
   * Home only: open on the visitor's own corridor, guessed from the browser's
   * timezone, with `initialAmount` (or 1000) in its currency. The server render
   * keeps `initialCorridor`, so the cached page is the same for everyone; the
   * switch happens as the page hydrates.
   */
  locateVisitor?: boolean
}

/** The timezone never changes under a loaded page, so nothing to subscribe to. */
const subscribeNever = () => () => {}

const DEFAULT_IDS = { from: 'search-from', method: 'search-method', amount: 'search-amount' }

/** Short names for the one-row bar, where the full ones do not fit at lg. */
const ROW_SHORT_NAMES: Record<string, string> = { GB: 'UK', AE: 'UAE', SA: 'KSA', US: 'USA' }

export function compareHref(
  locale: Locale,
  corridor: string,
  payout: PayoutOption,
  amount: number | string,
): string {
  const params = new URLSearchParams({ from: corridor, to: payout, amount: String(amount) })
  return `${localePath(locale, '/compare')}?${params}`
}

function PayoutBadge({ method }: { method: PayoutOption }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-icon-bg">
      <PayoutMethodIcon method={method} />
    </span>
  )
}

const labelClass = 'mb-2 sm:mb-3 block text-[13px] font-semibold tracking-[0.04em] text-muted uppercase'

// Every control opts out of the focus outline: the design shows no focus state.
// Phones get the smaller size so the whole hero card fits on the first screen.
const bigTrigger =
  'h-10 w-full bg-transparent text-[18px] font-semibold text-ink sm:h-11 sm:text-[22px] ' +
  'focus:outline-none focus-visible:outline-none'

/** Row-layout selects with no box: flush with their labels. */
const rowPlainTrigger =
  'h-full w-full bg-transparent pe-2 text-[18px] font-semibold text-ink ' +
  'focus:outline-none focus-visible:outline-none'

export function CompareSearch({
  corridors,
  initialCorridor,
  initialPayout = 'bank',
  initialAmount,
  className = '',
  layout = 'stacked',
  onCompare,
  busy = false,
  onCorridorChange,
  ids = DEFAULT_IDS,
  bare = false,
  onPendingChange,
  locateVisitor = false,
}: Props) {
  const t = useTranslations('panel')
  const tm = useTranslations('methods')
  const locale = useLocale() as Locale
  // On /compare the page owns the navigation, so its results can show a
  // skeleton; anywhere else the form pushes straight to /compare's loading
  // state. Either way the skeleton stays up for at least a second.
  const shared = useCompareNavigation()
  // Any /compare URL will do for the prefetch: the loading state it caches is
  // the same for every query.
  const [ownPending, ownNavigate] = useArrivalNavigation(
    shared || onCompare ? null : compareHref(locale, 'uk', 'bank', 500),
  )
  const navigating = onCompare ? busy : shared ? shared.pending : ownPending
  const navigate = shared ? shared.navigate : ownNavigate

  useEffect(() => {
    onPendingChange?.(navigating)
  }, [navigating, onPendingChange])

  const first = corridors.find((c) => c.slug === initialCorridor) ?? corridors[0]
  // Null on the server and while hydrating, then the visitor's corridor.
  const located = useSyncExternalStore(
    subscribeNever,
    () => (locateVisitor ? detectVisitorCorridor() : null),
    () => null,
  )
  const local = corridors.find((c) => c.slug === located)
  // Null until the visitor picks or types; until then the defaults follow
  // `local`, so a pick is never overwritten by the location guess.
  const [pickedCorridor, setCorridor] = useState<string | null>(null)
  const [typedAmount, setAmountText] = useState<string | null>(null)
  const corridor = pickedCorridor ?? local?.slug ?? first?.slug ?? 'uk'
  const amountText =
    typedAmount ?? String(initialAmount ?? (local ? 1000 : (first?.defaultAmount ?? 500)))
  const [payout, setPayout] = useState<PayoutOption>(initialPayout)

  const current = corridors.find((c) => c.slug === corridor) ?? first

  function selectCorridor(next: string) {
    setCorridor(next)
    // Reset the amount to this corridor's standard figure — £500 carried over
    // to AED would be a tenth of what was meant.
    const target = corridors.find((c) => c.slug === next)
    const nextAmount = target ? String(target.defaultAmount) : amountText
    setAmountText(nextAmount)
    if (next !== corridor) onCorridorChange?.(next)
  }

  function selectPayout(next: PayoutOption) {
    setPayout(next)
  }

  function changeAmount(text: string) {
    setAmountText(text)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (navigating) return
    const amount = Number.parseFloat(amountText)
    if (!Number.isFinite(amount) || amount <= 0) return
    if (onCompare) return onCompare({ corridor, payout, amountText })
    navigate(compareHref(locale, corridor, payout, amount))
  }

  const countryOptions: IconSelectOption[] = corridors.map((option) => ({
    value: option.slug,
    label: option.countryName,
    // The one-row layout is narrow; use the short names the live panel uses.
    selectedLabel: layout === 'row' ? ROW_SHORT_NAMES[option.countryCode] : undefined,
    hint: option.currency,
    icon: <CountryFlag countryCode={option.countryCode} />,
  }))


  const payoutLabels: Record<PayoutOption, string> = {
    bank: tm('bank'),
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    sadapay: 'SadaPay',
    nayapay: 'NayaPay',
    cash: tm('cash'),
    rda: tm('rda'),
  }

  const payoutOptions: IconSelectOption[] = PAYOUT_OPTIONS.map((value) => ({
    value,
    label: payoutLabels[value],
    selectedLabel: layout === 'row' && value === 'rda' ? 'RDA' : undefined,
    icon: <PayoutBadge method={value} />,
  }))

  const fromSelect = (trigger: string) => (
    <IconSelect
      id={ids.from}
      label={t('sendingFrom')}
      value={corridor}
      options={countryOptions}
      onChange={selectCorridor}
      className={trigger}
      variant="hero"
    />
  )

  const methodSelect = (trigger: string) => (
    <IconSelect
      id={ids.method}
      label={t('recipientGets')}
      value={payout}
      options={payoutOptions}
      onChange={(value) => selectPayout(value as PayoutOption)}
      className={trigger}
      variant="hero"
    />
  )

  const row = layout === 'row'

  /**
   * Makes a whole row-bar section toggle its dropdown, not just the trigger.
   * `data-select-area` tells IconSelect the section is part of it, and the
   * label's own activation is cancelled so the trigger is not toggled twice.
   */
  const sectionProps = (triggerId: string) => ({
    'data-select-area': triggerId,
    onClick: (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-icon-select]')) return
      event.preventDefault()
      document.getElementById(triggerId)?.click()
    },
  })
  // The one-row bar is shorter than the hero card.
  const fieldHeight = row ? 'h-[52px]' : 'h-[52px] sm:h-[58px]'

  // The currency can be written as its code or its symbol, the reader's pick.
  // AED, SAR and QAR have no Latin symbol (see CURRENCY_SYMBOLS), so they keep
  // the plain code and no switch.
  const currencyDisplay = useCurrencyDisplay()
  const currencyCode = current?.currency ?? ''
  const symbol = CURRENCY_SYMBOLS[currencyCode as SendCurrency]
  const currencySymbol = symbol && symbol !== currencyCode ? symbol : null
  const label = row ? labelClass.replace('mb-3', 'mb-2') : labelClass

  /** Fixed values: the currency follows the country, and the recipient
   *  always gets PKR, so neither needs a dropdown of values. `flush` drops
   *  the side padding for a value in no box, so it lines up with its label. */
  const staticValue = (text: string, labelText: string, flush = false) => (
    <span
      className={`flex h-full items-center font-semibold text-ink ${
        row ? 'text-[18px]' : 'text-[18px] sm:text-[20px]'
      } ${flush ? '' : 'ps-2 pe-4 sm:pe-5'}`}
      aria-label={labelText}
    >
      {text}
    </span>
  )

  const amountField = (
    <div className="min-w-0">
      <label htmlFor={ids.amount} className={label}>
        {t('youSend')}
      </label>
      <div className={`flex ${fieldHeight} rounded-[8px] border-[3px] border-accent`}>
        <input
          id={ids.amount}
          value={amountText}
          onChange={(event) => changeAmount(event.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          aria-label={t('amountIn', { currency: current?.currency ?? '' })}
          className={`min-w-0 flex-1 bg-transparent font-display font-semibold text-ink tabular-nums
                      focus:outline-none focus-visible:outline-none ${
                        row ? 'px-4 text-[20px]' : 'px-4 text-[20px] sm:px-5 sm:text-[24px]'
                      }`}
        />
        {/* Hugs the code or symbol, so "$" takes less room than "USD"; the
            amount input takes whatever is left. */}
        <div className="shrink-0">
          {currencySymbol ? (
            <IconSelect
              id={`${ids.amount}-currency`}
              label={t('currencyDisplay')}
              value={currencyDisplay}
              options={[
                { value: 'code', label: currencyCode, icon: null },
                { value: 'symbol', label: currencySymbol, icon: null },
              ]}
              onChange={(value) => setCurrencyDisplay(value as CurrencyDisplay)}
              strongOptions
              className={`h-full w-full ps-2 pe-3 font-semibold text-ink focus:outline-none
                          focus-visible:outline-none ${row ? 'text-[18px]' : 'text-[18px] sm:pe-4 sm:text-[20px]'}`}
            />
          ) : (
            staticValue(currencyCode, t('currency'))
          )}
        </div>
      </div>
    </div>
  )

  const receiveField = (
    <div className="min-w-0">
      <span className={label}>{t('to')}</span>
      <div className={fieldHeight}>{staticValue('PKR', t('receiveCurrency'), true)}</div>
    </div>
  )

  const submitButton = (
    <button
      type="submit"
      aria-disabled={navigating || undefined}
      aria-busy={navigating || undefined}
      className={`relative ${fieldHeight} w-full cursor-pointer rounded-[8px] bg-gold font-display font-bold text-on-gold
                  transition-colors hover:bg-gold-hover focus:outline-none focus-visible:outline-none
                  active:scale-[.985] aria-disabled:cursor-progress aria-disabled:active:scale-100 ${
                    row
                      ? 'col-span-2 px-8 text-[18px] sm:col-span-1 sm:text-[19px] lg:col-span-1 lg:w-full'
                      : 'col-span-2 px-10 text-[18px] sm:col-span-1 sm:text-[20px] lg:w-auto'
                  }`}
    >
      {/* The label keeps its space while hidden, so the button does not change width. */}
      <span className={navigating ? 'invisible' : undefined}>{t('compareShort')}</span>
      {navigating && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 animate-spin">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span className="sr-only" role="status">
        {navigating ? t('comparing') : ''}
      </span>
    </button>
  )

  // The hero card floats over the gradient; the one-row bar sits on the page
  // background and only needs a faint lift.
  const formClass = `relative z-20 ${
    bare
      ? ''
      : `rounded-[22px] bg-surface ${
          row
            ? 'shadow-[0_6px_20px_-10px_rgba(20,32,27,.12),0_1px_2px_rgba(20,32,27,.04)]'
            : 'shadow-[0_30px_70px_-35px_rgba(20,32,27,.35),0_2px_8px_rgba(20,32,27,.06)]'
        }`
  } ${className}`

  if (row) {
    /*
      Below lg the bar has no room for one row, so it takes the hero card's
      shape instead: country and payout as sections, then amount and
      "To" side by side with the button under them. The two wrappers are
      `lg:contents`, so at lg they vanish and their children become the five
      columns of the bar. One form either way, so the control ids stay unique.
    */
    const sectionHover =
      'cursor-pointer transition-colors lg:hover:bg-tint/45 lg:[&:hover_button]:text-tint-ink lg:[&:hover_label]:text-tint-ink'
    return (
      <form
        onSubmit={onSubmit}
        className={`${formClass} lg:grid lg:items-end lg:gap-4 lg:px-6 lg:py-4
                    lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1.2fr)_auto_170px]`}
      >
        {/* The route as a backdrop: the sending country's flag at the start,
            Pakistan's at the end, in the corridor cards' watermark style. They
            get their own clipped layer because the form cannot clip: its
            dropdowns hang below it. Styles in globals.css. */}
        {!bare && current && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[22px]"
          >
            <span className="flag-mark flag-mark--bar flag-mark--bar-start">
              <CountryFlag countryCode={current.countryCode} />
            </span>
            <span className="flag-mark flag-mark--bar flag-mark--bar-end">
              <CountryFlag countryCode="PK" />
            </span>
          </span>
        )}
        <div className="grid sm:grid-cols-2 lg:contents">
          {/* -my-4/py-4 (and -ms-6/ps-6 on the first) cancel the form's padding so
              the hover tint runs to the card's edges. */}
          <div
            className={`min-w-0 px-5 py-4 sm:px-7 sm:py-5
                        lg:-my-4 lg:-ms-6 lg:-me-4 lg:rounded-s-[22px] lg:py-4 lg:ps-6 lg:pe-4 ${sectionHover}`}
            {...sectionProps(ids.from)}
          >
            <label htmlFor={ids.from} className={label}>
              {t('sendingFrom')}
            </label>
            <div className={fieldHeight}>{fromSelect(rowPlainTrigger)}</div>
          </div>
          <div
            className={`min-w-0 px-5 py-4 sm:px-7 sm:py-5 lg:-my-4 lg:-me-4
                        lg:py-4 lg:ps-4 lg:pe-4 ${sectionHover}`}
            {...sectionProps(ids.method)}
          >
            <label htmlFor={ids.method} className={label}>
              <span className="lg:hidden">{t('recipientGets')}</span>
              <span className="hidden lg:inline">{t('recipientGetsShort')}</span>
            </label>
            <div className={fieldHeight}>{methodSelect(rowPlainTrigger)}</div>
          </div>
        </div>

        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-4 px-5 py-4
                     sm:grid-cols-1 sm:gap-5 sm:px-7 sm:py-6 lg:contents"
        >
          <div className="min-w-0 lg:ps-4">{amountField}</div>
          {receiveField}
          {submitButton}
        </div>
      </form>
    )
  }

  /* Three tiles — country, payout, then amount and button — with the same
     gap between them as around them, set on the page's own colour (mist in
     light, the header colour in dark) so they read as panels on the card. */
  const tile = 'min-w-0 rounded-[16px] bg-mist px-5 py-4 sm:px-7 sm:py-6 dark:bg-header'

  return (
    <form onSubmit={onSubmit} className={`${formClass} grid gap-3 p-3 sm:gap-4 sm:p-4`}>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className={tile}>
          <label htmlFor={ids.from} className={labelClass}>
            {t('sendingFrom')}
          </label>
          {fromSelect(bigTrigger)}
        </div>

        <div className={tile}>
          <label htmlFor={ids.method} className={labelClass}>
            {t('recipientGets')}
          </label>
          {methodSelect(bigTrigger)}
        </div>
      </div>

      {/* "To" is only ever PKR, so its column hugs the text; at lg the amount
          and the button split what is left about evenly. On phones the amount
          and "To" share a row and the button runs full width under them. */}
      <div
        className={`${tile} grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-4
                    sm:grid-cols-1 sm:gap-5 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(250px,1fr)] lg:gap-6`}
      >
        {amountField}
        {receiveField}
        {submitButton}
      </div>
    </form>
  )
}
