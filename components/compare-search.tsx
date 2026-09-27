'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { IconSelect, type IconSelectOption } from '@/components/icon-select'
import { CountryFlag, PayoutMethodIcon, type PayoutOption } from '@/components/select-icons'
import { type Locale, localePath } from '@/i18n/routing'
import { PAYOUT_OPTIONS } from '@/lib/payout'

/**
 * The search form in the home hero and at the top of /compare.
 *
 * By default it does not fetch anything itself: Compare navigates to /compare
 * with the selection in the query string, and that page renders the ranked
 * results on the server. With `onSelectionChange` it is the live ComparePanel's
 * controls instead: every edit is reported and nothing navigates.
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
  /** Live mode: called on every change instead of navigating on submit. */
  onSelectionChange?: (selection: SearchSelection) => void
  /** Control ids, for pages that link or test against the old panel's ids. */
  ids?: { from: string; method: string; amount: string }
}

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

const labelClass = 'mb-3 block text-[13px] font-semibold tracking-[0.04em] text-muted uppercase'

// Every control opts out of the focus outline: the design shows no focus state.
const bigTrigger =
  'h-11 w-full bg-transparent text-[20px] font-semibold text-ink sm:text-[22px] ' +
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
  onSelectionChange,
  ids = DEFAULT_IDS,
}: Props) {
  const t = useTranslations('panel')
  const tm = useTranslations('methods')
  const locale = useLocale() as Locale
  const router = useRouter()

  const first = corridors.find((c) => c.slug === initialCorridor) ?? corridors[0]
  const [corridor, setCorridor] = useState(first?.slug ?? 'uk')
  const [payout, setPayout] = useState<PayoutOption>(initialPayout)
  const [amountText, setAmountText] = useState(String(initialAmount ?? first?.defaultAmount ?? 500))

  const current = corridors.find((c) => c.slug === corridor) ?? first

  function report(next: Partial<SearchSelection>) {
    onSelectionChange?.({ corridor, payout, amountText, ...next })
  }

  function selectCorridor(next: string) {
    setCorridor(next)
    // Reset the amount to this corridor's standard figure — £500 carried over
    // to AED would be a tenth of what was meant.
    const target = corridors.find((c) => c.slug === next)
    const nextAmount = target ? String(target.defaultAmount) : amountText
    setAmountText(nextAmount)
    report({ corridor: next, amountText: nextAmount })
  }

  function selectPayout(next: PayoutOption) {
    setPayout(next)
    report({ payout: next })
  }

  function changeAmount(text: string) {
    setAmountText(text)
    report({ amountText: text })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    // Live mode is already up to date; the button is only a focus target.
    if (onSelectionChange) return
    const amount = Number.parseFloat(amountText)
    if (!Number.isFinite(amount) || amount <= 0) return
    router.push(compareHref(locale, corridor, payout, amount))
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
  const fieldHeight = row ? 'h-[52px]' : 'h-[58px]'
  const label = row ? labelClass.replace('mb-3', 'mb-2') : labelClass

  /** Fixed values: the currency follows the country, and the recipient
   *  always gets PKR, so neither needs a dropdown. */
  const staticValue = (text: string, labelText: string) => (
    <span
      className={`flex h-full items-center font-semibold text-ink ${
        row ? 'px-4 text-[18px]' : 'px-5 text-[20px]'
      }`}
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
                        row ? 'px-4 text-[20px]' : 'px-5 text-[24px]'
                      }`}
        />
        <div className={`${row ? 'w-[76px]' : 'w-[100px]'} shrink-0 border-s-[3px] border-line`}>
          {staticValue(current?.currency ?? '', t('currency'))}
        </div>
      </div>
    </div>
  )

  const receiveField = (
    <div className="min-w-0">
      <span className={label}>{t('to')}</span>
      <div className={`${fieldHeight} rounded-[8px] border-[3px] border-line`}>
        {staticValue('PKR', t('receiveCurrency'))}
      </div>
    </div>
  )

  const submitButton = (
    <button
      type="submit"
      className={`${fieldHeight} w-full cursor-pointer rounded-[8px] bg-gold font-display font-bold text-on-gold
                  transition-colors hover:bg-gold-hover focus:outline-none focus-visible:outline-none
                  active:scale-[.985] lg:w-auto ${row ? 'px-8 text-[19px]' : 'px-10 text-[20px]'}`}
    >
      {t('compareShort')}
    </button>
  )

  // The hero card floats over the gradient; the one-row bar sits on the page
  // background and only needs a faint lift.
  const formClass = `relative z-20 rounded-[22px] bg-surface ${
    row
      ? 'shadow-[0_6px_20px_-10px_rgba(20,32,27,.12),0_1px_2px_rgba(20,32,27,.04)]'
      : 'shadow-[0_30px_70px_-35px_rgba(20,32,27,.35),0_2px_8px_rgba(20,32,27,.06)]'
  } ${className}`

  if (row) {
    return (
      <form
        onSubmit={onSubmit}
        className={`${formClass} grid items-end gap-4 p-5 sm:grid-cols-2 lg:px-6 lg:py-4
                    lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)_minmax(0,1.2fr)_96px_auto]`}
      >
        {/* Vertical rules after the first two fields, desktop only. -my-4/py-4
            (and -ms-6/ps-6 on the first) cancel the form's padding so the rules
            and the hover tint run to the card's edges. */}
        <div className="min-w-0 rounded-[12px] lg:-my-4 lg:-ms-6 lg:-me-4 lg:rounded-none lg:rounded-s-[22px] lg:border-e-[3px] lg:border-line lg:py-4 lg:ps-6 lg:pe-4 cursor-pointer transition-colors lg:hover:bg-tint lg:[&:hover_button]:text-tint-ink lg:[&:hover_label]:text-tint-ink" {...sectionProps(ids.from)}>
          <label htmlFor={ids.from} className={label}>
            {t('sendingFrom')}
          </label>
          <div className={fieldHeight}>{fromSelect(rowPlainTrigger)}</div>
        </div>
        <div className="min-w-0 rounded-[12px] lg:-my-4 lg:-me-4 lg:rounded-none lg:border-e-[3px] lg:border-line lg:py-4 lg:ps-4 lg:pe-4 cursor-pointer transition-colors lg:hover:bg-tint lg:[&:hover_button]:text-tint-ink lg:[&:hover_label]:text-tint-ink" {...sectionProps(ids.method)}>
          <label htmlFor={ids.method} className={label}>
            {t('recipientGetsShort')}
          </label>
          <div className={fieldHeight}>{methodSelect(rowPlainTrigger)}</div>
        </div>
        <div className="min-w-0 lg:ps-4">{amountField}</div>
        {receiveField}
        {submitButton}
      </form>
    )
  }

  return (
    <form onSubmit={onSubmit} className={formClass}>
      <div className="grid border-b-[3px] border-line sm:grid-cols-2">
        <div className="min-w-0 border-b-[3px] border-line px-6 py-5 sm:border-e-[3px] sm:border-b-0 sm:px-7 sm:py-6">
          <label htmlFor={ids.from} className={labelClass}>
            {t('sendingFrom')}
          </label>
          {fromSelect(bigTrigger)}
        </div>

        <div className="min-w-0 px-6 py-5 sm:px-7 sm:py-6">
          <label htmlFor={ids.method} className={labelClass}>
            {t('recipientGets')}
          </label>
          {methodSelect(bigTrigger)}
        </div>
      </div>

      {/* "To" is only ever PKR, so its column hugs the text; the button takes
          the width it frees up. */}
      <div className="grid items-end gap-5 px-6 py-5 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto_250px] lg:gap-6">
        {amountField}
        {receiveField}
        {submitButton}
      </div>
    </form>
  )
}
