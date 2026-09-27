'use client'

import Link from 'next/link'
import { useRef, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Comparison } from '@/lib/quotes'
import type { SortKey } from '@/lib/ranking/rank'
import { formatPkr } from '@/lib/ranking/compute'
import { formatSend } from '@/lib/corridors'
import { staticPath } from '@/lib/routes'
import type { Locale } from '@/i18n/routing'
import { ProviderLogo } from '@/components/provider-logo'
import type { PayoutOption } from '@/components/select-icons'
import { isNamedBankAccount } from '@/lib/payout'

/**
 * Ranked results on /compare.
 *
 * Server-rendered with the requested selection; the sort pills re-fetch from
 * /api/quotes so all ranking still happens on the server, exactly as in the
 * live ComparePanel.
 */

const SORT_KEYS: SortKey[] = ['received', 'fastest', 'lowest-fee']

type ResultsLayout = 'list' | 'grid'

/** The reader's last layout choice, kept per browser. */
const LAYOUT_STORAGE_KEY = 'pakremits:results-layout'

const SORT_LABEL_KEY: Record<SortKey, 'sortReceived' | 'sortFastest' | 'sortLowestFee'> = {
  received: 'sortReceived',
  fastest: 'sortFastest',
  'lowest-fee': 'sortLowestFee',
}

/** Shared pill shape so every badge and the speed chip match in height,
 *  padding and text size. */
const BADGE = 'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] leading-none'

/** The desktop columns, shared by the headings, the cards and the skeleton. */
const COLUMNS = 'list-view:grid-cols-[1.4fr_.7fr_.7fr_1.9fr_220px]'

/** Stacked (phone and grid view), the last row takes any spare height so the
 *  buttons line up along a grid row; at list-view the card is a single row. */
const CARD = `relative grid grid-rows-[auto_auto_auto_1fr] items-center gap-5 list-view:grid-rows-none rounded-[14px] border p-5 sm:p-7 ${COLUMNS} list-view:gap-6`

/** 0.0075 -> "+0.75%", -0.0042 -> "−0.42%". */
function signedPercent(fraction: number): string {
  const pct = fraction * 100
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`
}

interface Props {
  initial: Comparison
  payout: PayoutOption
  payoutLabel: string
}

export function CompareResults({ initial, payout, payoutLabel }: Props) {
  const [sort, setSort] = useState<SortKey>('received')
  const [data, setData] = useState<Comparison>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const requestSeq = useRef(0)

  function changeSort(next: SortKey) {
    if (next === sort) return
    setSort(next)
    const seq = ++requestSeq.current
    setPending(true)
    setError(false)

    const params = new URLSearchParams({
      corridor: initial.corridorSlug,
      method: initial.deliveryMethod,
      amount: String(initial.amount),
      sort: next,
    })

    fetch(`/api/quotes?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<Comparison>
      })
      .then((payload) => {
        if (seq === requestSeq.current) setData(payload)
      })
      .catch(() => {
        if (seq === requestSeq.current) setError(true)
      })
      .finally(() => {
        if (seq === requestSeq.current) setPending(false)
      })
  }

  return (
    <ResultsView
      data={data}
      sort={sort}
      onSort={changeSort}
      pending={pending}
      error={error}
      payout={payout}
      payoutLabel={payoutLabel}
      className="mt-12"
    />
  )
}

interface ViewProps {
  data: Comparison
  sort: SortKey
  onSort: (sort: SortKey) => void
  pending: boolean
  error: boolean
  payout: PayoutOption
  payoutLabel: string
  className?: string
  /** Show when the quotes were captured under the heading (the live panel;
   *  /compare prints its own refresh line above). */
  showCapturedAt?: boolean
}

/** 24-hour Karachi time, fixed zone so server and client render the same. */
const CAPTURED_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * The results cards themselves, with no data fetching: /compare re-fetches only
 * on a sort change, the live ComparePanel on every edit, and both render this.
 */
export function ResultsView({
  data,
  sort,
  onSort,
  pending,
  error,
  payout,
  payoutLabel,
  className = '',
  showCapturedAt = false,
}: ViewProps) {
  const t = useTranslations('panel')
  const locale = useLocale()
  const layout = useResultsLayout()

  const speedLabel = (minutes: number | null, fallback: string): string => {
    if (locale === 'en') return fallback
    if (minutes === null) return t('speedVaries')
    if (minutes <= 30) return t('speedMinutes')
    if (minutes <= 360) return t('speedHours')
    if (minutes <= 1440) return t('speedSameDay')
    return t('speedFewDays')
  }

  const promoLabel = (note: string): string =>
    note === 'New-customer rate' ? t('promoNewCustomer') : note

  const symbol = data.currencySymbol
  // The winner card shows the list's lowest amount struck through, so the gap is
  // visible at a glance. Null when there is nothing to compare against.
  const lowestReceived =
    data.rows.length > 1 ? Math.min(...data.rows.map((r) => r.quote.amountReceived)) : null

  return (
    <section
      className={className}
      aria-live="polite"
      aria-busy={pending}
      data-view={layout.value}
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-[26px] font-semibold text-ink">{t('resultsHeading')}</h2>
          {showCapturedAt && data.capturedAt && (
            <p className="mt-1 text-[13.5px] text-muted">
              {t('capturedAt', { time: CAPTURED_TIME.format(new Date(data.capturedAt)) })}
            </p>
          )}
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <SortPills sort={sort} onSort={onSort} />
          <LayoutToggle layout={layout.value} onChange={layout.set} />
        </div>
      </div>

      {isNamedBankAccount(payout) && (
        <p className="mt-3 max-w-[70ch] text-[13px] text-muted">
          {t('bankAccountRateNote', { account: payoutLabel })}
        </p>
      )}

      {error && (
        <p className="mt-4 text-[13px] text-danger" role="status">
          {t('refreshError')}
        </p>
      )}

      <ColumnHeadings />

      <ul
        className={`mt-7 grid gap-4 list-view:mt-3 transition-opacity ${
          layout.value === 'grid' ? 'lg:grid-cols-2 xl:grid-cols-3' : ''
        } ${pending ? 'opacity-60' : ''}`}
      >
        {data.rows.length === 0 && (
          <li
            className={`rounded-[14px] border border-line bg-surface p-8 text-center ${
              data.unavailable ? 'text-danger' : 'text-muted'
            }`}
          >
            {data.unavailable
              ? t('unavailable')
              : t('emptyState', { currency: data.fromCurrency })}
          </li>
        )}

        {data.rows.map((row) => {
          const q = row.quote
          const isBest = row.isBest
          const fast = (q.deliverySpeedMinutes ?? Number.POSITIVE_INFINITY) <= 600

          return (
            <li
              key={q.providerSlug}
              className={`${CARD} ${
                            // The best deal wears the site's hover tint.
                            isBest ? 'border-[3px] border-gold bg-tint' : 'border-line bg-surface'
                          }`}
            >
              {isBest && (
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute -top-5 -end-4 h-10 w-10 rotate-[18deg] rtl:-rotate-[18deg]
                             drop-shadow-[0_2px_3px_rgba(74,54,8,0.35)]"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"
                    fill="var(--color-gold)"
                    stroke="#7a5a06"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <rect x="5" y="19" width="14" height="2" rx="1" fill="#7a5a06" />
                  <circle cx="3" cy="8" r="1.4" fill="var(--color-gold)" stroke="#7a5a06" strokeWidth="0.8" />
                  <circle cx="12" cy="5" r="1.4" fill="var(--color-gold)" stroke="#7a5a06" strokeWidth="0.8" />
                  <circle cx="21" cy="8" r="1.4" fill="var(--color-gold)" stroke="#7a5a06" strokeWidth="0.8" />
                </svg>
              )}
              {/* Provider. Below lg the card stacks: provider, amount, a detail box
                  (speed, fee, rate) and the button; the rate and fee columns and the
                  speed chip here are desktop-only. */}
              <div className="flex items-center gap-4 border-b border-line pb-5 list-view:border-0 list-view:pb-0">
                <ProviderLogo
                  providerSlug={q.providerSlug}
                  providerName={q.providerName}
                  brandColor={q.brandColor}
                  brandTextColor={q.brandTextColor}
                  size="small"
                />
                <div className="min-w-0">
                  <div className="font-display text-[19px] leading-tight font-semibold">
                    {q.providerName}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {isBest && (
                      <span className={`${BADGE} bg-gold font-bold text-[#4A3608]`}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[11px] w-[11px]" aria-hidden="true">
                          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                        </svg>
                        {t('bestDeal')}
                      </span>
                    )}
                    {/* Sponsored placement sits below the winner, never above.
                        The label is not optional — see /how-we-rank. */}
                    {q.featured && !isBest && (
                      <span className={`${BADGE} bg-line-2 text-muted`}>
                        {t('sponsored')}
                      </span>
                    )}
                    {q.promo && q.promoNote && (
                      <span className={`${BADGE} bg-promo-bg text-promo`}>
                        <bdi>{promoLabel(q.promoNote)}</bdi>
                      </span>
                    )}
                    {q.stale && (
                      <span className={`${BADGE} bg-gold-bg text-gold-dark`}>
                        {t('stale')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 hidden flex-wrap items-center gap-2 text-[14px] text-muted list-view:flex">
                    {q.isBenchmark ? t('swiftTransfer') : t('bankDeposit')}
                    <span
                      className={`${BADGE} ${
                        fast ? 'bg-icon-bg text-ok' : 'bg-line-2 text-muted'
                      }`}
                    >
                      {fast && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3" aria-hidden="true">
                          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                        </svg>
                      )}
                      <bdi>{speedLabel(q.deliverySpeedMinutes, q.deliverySpeedText)}</bdi>
                    </span>
                  </div>
                </div>
              </div>

              {/* Rate */}
              <div className="hidden tabular-nums list-view:block">
                <div className="font-display text-[21px] leading-tight font-semibold">
                  {q.rate.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[13.5px] text-muted">{t('perUnit', { symbol })}</div>
              </div>

              {/* Fee */}
              <div className="hidden tabular-nums list-view:block">
                <div className="font-display text-[21px] leading-tight font-semibold">
                  {formatSend(symbol, q.fee.toFixed(2))}
                </div>
              </div>

              {/* Recipient gets */}
              <div className="tabular-nums">
                <div className="text-[13.5px] text-muted list-view:hidden">{t('columnReceives')}</div>
                {/* The struck-through lowest follows the amount on the same line;
                    it wraps below it only where the column is too narrow. */}
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 list-view:gap-x-2">
                  <b className="block font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">
                    {formatPkr(q.amountReceived)}
                  </b>
                  {isBest && lowestReceived !== null && lowestReceived < q.amountReceived && (
                    <span className="font-display text-[17px] leading-none font-semibold text-muted list-view:text-[14px]">
                      <span className="sr-only">
                        {t('lowestInList', { amount: formatPkr(lowestReceived) })}
                      </span>
                      <s aria-hidden="true" className="decoration-danger decoration-2 dark:decoration-bar-low">
                        {formatPkr(lowestReceived)}
                      </s>
                    </span>
                  )}
                </div>
                <div className="my-3 h-1.5 overflow-hidden rounded-full bg-line-2">
                  <i
                    className="block h-full rounded-full"
                    style={{
                      width: `${row.barPercent}%`,
                      background: q.isBenchmark ? 'var(--color-bar-low)' : 'var(--color-bar)',
                    }}
                  />
                </div>
                <div
                  className={`text-[14px] font-bold ${
                    isBest
                      ? 'whitespace-nowrap text-leaf dark:text-bar'
                      : q.isBenchmark
                        ? 'text-danger dark:text-bar-low'
                        : 'text-muted'
                  }`}
                >
                  {isBest && data.savingVsBank !== null
                    ? t('moreThanBank', { amount: formatPkr(data.savingVsBank) })
                    : row.diffFromBest === 0
                      ? t('bestAvailable')
                      : t('lessThanBest', { amount: formatPkr(Math.abs(row.diffFromBest)) })}
                </div>
              </div>

              {/* Mobile detail box: one column, every line on the same start edge —
                  label, value, then its detail on the line below — so nothing floats at the far end. */}
              <div className="grid rounded-[12px] bg-mist tabular-nums list-view:hidden">
                <div className="border-b border-line px-4 py-3.5">
                  <div className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">
                    {t('transferTime')}
                  </div>
                  <div className="mt-1 grid gap-0.5">
                    <span className="font-display text-[17px] leading-tight font-semibold">
                      <bdi>{speedLabel(q.deliverySpeedMinutes, q.deliverySpeedText)}</bdi>
                    </span>
                    <span className="text-[13.5px] text-muted">
                      {q.isBenchmark ? t('swiftTransfer') : t('bankDeposit')}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">
                    {t('feeAndRate')}
                  </div>
                  <div className="mt-1 grid gap-0.5">
                    <span
                      className={`font-display text-[17px] leading-tight font-semibold ${
                        q.fee === 0 ? 'text-leaf dark:text-bar' : ''
                      }`}
                    >
                      {q.fee === 0 ? t('free') : formatSend(symbol, q.fee.toFixed(2))}
                    </span>
                    <span className="text-[13.5px] text-muted">
                      {t('rateLine', { rate: q.rate.toFixed(2) })}
                      {data.midMarketRate !== null && data.midMarketRate > 0 && (
                        <>
                          {', '}
                          {t('vsMidMarket', {
                            percent: signedPercent(
                              (q.rate - data.midMarketRate) / data.midMarketRate,
                            ),
                          })}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="self-end list-view:self-auto">
                {q.isBenchmark ? (
                  <Link
                    // Through staticPath, not hard-coded, so Urdu readers stay in Urdu.
                    href={`${staticPath('how-we-rank', locale as Locale)}#bank-benchmark`}
                    className="flex h-[54px] w-full items-center justify-center rounded-[8px] border-[1.5px]
                               border-line bg-surface text-[16px] font-medium text-ink no-underline
                               transition-[border-color,box-shadow] hover:border-accent
                               hover:shadow-[0_0_0_1.5px_var(--color-accent)]"
                  >
                    {t('whySoLow')}
                  </Link>
                ) : (
                  <a
                    href={`/go/${q.providerSlug}?corridor=${data.corridorSlug}&amount=${data.amount}&method=${data.deliveryMethod}`}
                    // Affiliate links must be marked for search engines.
                    rel="sponsored nofollow"
                    className={`flex h-[54px] w-full items-center justify-center gap-2 rounded-[8px]
                                text-[16px] font-bold whitespace-nowrap no-underline transition-colors ${
                                  isBest
                                    ? 'bg-gold text-on-gold hover:bg-gold-hover'
                                    : 'border-[1.5px] border-line bg-surface text-ink hover:border-accent hover:shadow-[0_0_0_1.5px_var(--color-accent)]'
                                }`}
                  >
                    {t('sendWith', { provider: q.providerName.split(' ')[0] })}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M7 17L17 7M8 7h9v9" />
                    </svg>
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex flex-col justify-between gap-2 text-[12.5px] text-faint sm:flex-row sm:gap-6">
        <span>
          {t('disclaimerQuotes')}
          {data.amount !== data.quotedAtAmount &&
            ` ${t('disclaimerCaptured', { amount: formatSend(symbol, data.quotedAtAmount) })}`}
        </span>
        <span>{t('disclaimerCommission')}</span>
      </div>
    </section>
  )
}

/**
 * The sort control. Without `onSort` it is inert, for the skeleton.
 */
function SortPills({ sort, onSort }: { sort: SortKey; onSort?: (sort: SortKey) => void }) {
  const t = useTranslations('panel')
  return (
    <div
      // flex-wrap on the group, nowrap inside each pill: Urdu labels are
      // longer than the English.
      // Segmented control: the grey backing shows through the 3px gaps as
      // dividers, matching the field borders.
      className="flex w-full gap-[3px] overflow-hidden rounded-[10px] border-[3px] border-line bg-line sm:w-auto"
      role="group"
      aria-label={t('sortBy')}
    >
      {SORT_KEYS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSort?.(value)}
          disabled={!onSort}
          aria-pressed={sort === value}
          className={`flex-1 cursor-pointer px-3 py-3 text-[15px] font-bold whitespace-nowrap sm:flex-none sm:px-6 sm:text-[16px]
                      transition-colors ${
                        sort === value
                          ? 'bg-brand text-white'
                          : 'bg-surface text-ink-2 enabled:hover:bg-tint enabled:hover:text-tint-ink'
                      } disabled:cursor-default`}
        >
          {t(SORT_LABEL_KEY[value])}
        </button>
      ))}
    </div>
  )
}

/**
 * List or grid, remembered in localStorage and shared by every results view on
 * the page. The server snapshot is always list, so hydration matches and a
 * saved grid choice applies right after.
 */
const layoutListeners = new Set<() => void>()
/** Fallback when storage is blocked: the choice lasts for this page only. */
let memoryLayout: ResultsLayout = 'list'

function readLayout(): ResultsLayout {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return memoryLayout
  }
}

function subscribeLayout(onChange: () => void) {
  layoutListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    layoutListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function useResultsLayout() {
  const value = useSyncExternalStore(subscribeLayout, readLayout, () => 'list' as const)

  function set(next: ResultsLayout) {
    memoryLayout = next
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, next)
    } catch {
      // Storage blocked: memoryLayout carries it.
    }
    layoutListeners.forEach((listener) => listener())
  }

  return { value, set }
}

/**
 * List/grid switch beside the sort pills. Desktop only: below lg both layouts
 * are the same stacked cards. Without `onChange` it is inert, for the skeleton.
 */
function LayoutToggle({
  layout,
  onChange,
}: {
  layout: ResultsLayout
  onChange?: (layout: ResultsLayout) => void
}) {
  const t = useTranslations('panel')
  const options: { value: ResultsLayout; label: string; icon: React.ReactNode }[] = [
    {
      value: 'list',
      label: t('viewList'),
      icon: <path d="M4 6h16M4 12h16M4 18h16" />,
    },
    {
      value: 'grid',
      label: t('viewGrid'),
      icon: (
        <>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </>
      ),
    },
  ]

  return (
    <div
      // Same segmented shape as the sort pills.
      className="hidden shrink-0 gap-[3px] overflow-hidden rounded-[10px] border-[3px] border-line bg-line lg:flex"
      role="group"
      aria-label={t('viewAs')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange?.(option.value)}
          disabled={!onChange}
          aria-pressed={layout === option.value}
          aria-label={option.label}
          title={option.label}
          className={`flex w-[50px] cursor-pointer items-center justify-center py-3 transition-colors ${
            layout === option.value
              ? 'bg-brand text-white'
              : 'bg-surface text-ink-2 enabled:hover:bg-tint enabled:hover:text-tint-ink'
          } disabled:cursor-default`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            {option.icon}
          </svg>
        </button>
      ))}
    </div>
  )
}

function ColumnHeadings() {
  const t = useTranslations('panel')
  return (
    <div
      className={`mt-7 hidden ${COLUMNS} gap-6 px-7 text-[14.5px] text-muted list-view:grid`}
      aria-hidden="true"
    >
      <span>{t('columnProvider')}</span>
      <span>{t('columnRate')}</span>
      <span>{t('columnFee')}</span>
      <span>{t('columnReceives')}</span>
      <span />
    </div>
  )
}

/** One grey placeholder bar; `.skeleton` in globals.css gives it the shimmer. */
export function Bone({ className }: { className: string }) {
  return <span className={`skeleton block rounded-[6px] ${className}`} />
}

/** Varied so the placeholder rows do not read as a repeating pattern. */
const SKELETON_ROWS = [
  { name: 'w-28', badge: 'w-24', amount: 'w-44', bar: '100%', note: 'w-52' },
  { name: 'w-20', badge: null, amount: 'w-40', bar: '92%', note: 'w-40' },
  { name: 'w-32', badge: null, amount: 'w-36', bar: '84%', note: 'w-44' },
]

/**
 * Stands in for ResultsView while a new search loads: the same heading, sort
 * control, columns and card layout (stacked below lg, a row at lg), with bars
 * sized to the text each one replaces.
 */
export function ResultsSkeleton({ className = '' }: { className?: string }) {
  const t = useTranslations('panel')

  return (
    <section className={className} aria-busy="true" data-view="list">
      <p className="sr-only" role="status">
        {t('comparing')}
      </p>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="font-display text-[26px] font-semibold text-ink">{t('resultsHeading')}</h2>
        {/* The new page always opens on the default sort. */}
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <SortPills sort="received" />
          <LayoutToggle layout="list" />
        </div>
      </div>

      <ColumnHeadings />

      <ul className="mt-7 grid gap-4 list-view:mt-3" aria-hidden="true">
        {SKELETON_ROWS.map((row, index) => (
          <li key={index} className={`${CARD} border-line bg-surface`}>
            {/* Provider */}
            <div className="flex items-center gap-4 border-b border-line pb-5 list-view:border-0 list-view:pb-0">
              <span className="skeleton block h-10 w-10 shrink-0 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <Bone className={`h-[22px] ${row.name}`} />
                {row.badge && <span className={`skeleton mt-1.5 block h-6 rounded-full ${row.badge}`} />}
                <div className="mt-1.5 hidden items-center gap-2 list-view:flex">
                  <Bone className="h-4 w-24" />
                  <span className="skeleton block h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>

            {/* Rate */}
            <div className="hidden list-view:block">
              <Bone className="h-[26px] w-16" />
              <Bone className="mt-1 h-4 w-10" />
            </div>

            {/* Fee */}
            <div className="hidden list-view:block">
              <Bone className="h-[26px] w-16" />
            </div>

            {/* Recipient gets */}
            <div>
              <Bone className="mb-1.5 h-4 w-24 list-view:hidden" />
              <Bone className={`h-7 max-w-full ${row.amount}`} />
              <div className="my-3 h-1.5 overflow-hidden rounded-full bg-line-2">
                <span className="skeleton block h-full rounded-full" style={{ width: row.bar }} />
              </div>
              <Bone className={`h-4 max-w-full ${row.note}`} />
            </div>

            {/* Mobile detail box */}
            <div className="grid rounded-[12px] bg-mist list-view:hidden">
              {/* Same one-column stack as the real box: label, value, detail. */}
              {['w-24', 'w-48'].map((detail, box) => (
                <div key={box} className={`px-4 py-3.5 ${box === 0 ? 'border-b border-line' : ''}`}>
                  <Bone className="h-3 w-24" />
                  <Bone className="mt-2 h-5 w-20" />
                  <Bone className={`mt-1.5 h-4 ${detail}`} />
                </div>
              ))}
            </div>

            {/* Action */}
            <span className="skeleton block h-[54px] w-full rounded-[8px]" />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col justify-between gap-2 sm:flex-row sm:gap-6" aria-hidden="true">
        <Bone className="h-3.5 w-full max-w-[420px]" />
        <Bone className="h-3.5 w-full max-w-[260px]" />
      </div>
    </section>
  )
}
