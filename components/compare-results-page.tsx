'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { use, useEffect, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CompareNavigationProvider, WhileComparing } from '@/components/compare-navigation'
import { CompareResults, ResultsSkeleton } from '@/components/compare-results'
import { CardsSkeleton, SummarySkeleton, TitleSkeleton } from '@/components/compare-skeletons'
import { CompareSearch, type SearchCorridorOption } from '@/components/compare-search'
import { CompareSheet } from '@/components/compare-sheet'
import { CountryFlag, PayoutMethodIcon } from '@/components/select-icons'
import { Sparkline } from '@/components/sparkline'
import { type Locale, localePath } from '@/i18n/routing'
import { type CorridorDataFile, comparisonFromSnapshot } from '@/lib/comparison'
import { CORRIDORS, corridorBySlug, defaultAmountFor } from '@/lib/corridors'
import { PAYOUT_METHOD, isPayoutOption } from '@/lib/payout'
import { loadCorridorData, recordComparison } from '@/lib/quote-data'
import { round } from '@/lib/ranking/compute'
import { staticPath } from '@/lib/routes'

/**
 * Search results, e.g. /compare?from=uk&to=bank&amount=500.
 *
 * Where the hero search form lands. The query string holds the selection, so
 * a results page can be shared or reloaded. The site is static, so the page
 * reads the query here in the browser and ranks the corridor's data file
 * with the same code the build uses for every other table.
 */

/** Data files load once per corridor; a failed one resolves to null, shown as an outage. */
const settled = new Map<string, Promise<CorridorDataFile | null>>()

function corridorData(slug: string): Promise<CorridorDataFile | null> {
  let file = settled.get(slug)
  if (!file) {
    file = loadCorridorData(slug).catch(() => {
      // Let the next search try again.
      settled.delete(slug)
      return null
    })
    settled.set(slug, file)
  }
  return file
}

const REFRESHED = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function CompareResultsPage({
  corridors,
  howWeRankLabel,
}: {
  corridors: SearchCorridorOption[]
  howWeRankLabel: string
}) {
  const query = useSearchParams()
  const corridor = corridorBySlug(query.get('from') ?? '') ?? CORRIDORS[0]
  const toParam = query.get('to') ?? undefined
  const payout = isPayoutOption(toParam) ? toParam : 'bank'
  const parsedAmount = Number.parseFloat(query.get('amount') ?? '')
  const amount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= 1_000_000
      ? parsedAmount
      : defaultAmountFor(corridor.fromCurrency)

  // Suspends until the corridor's quotes are here. Inside a Compare click's
  // transition that keeps the old results up, greyed out, until then.
  const data = use(corridorData(corridor.slug))

  const t = useTranslations('panel')
  const tc = useTranslations('compare')
  const tm = useTranslations('methods')
  const locale = useLocale() as Locale

  const comparison = useMemo(
    () => (data ? comparisonFromSnapshot(data, { method: PAYOUT_METHOD[payout], amount }) : null),
    [data, payout, amount],
  )

  // One count per search, deduplicated per minute by the Worker.
  useEffect(() => {
    if (data) recordComparison(corridor.slug)
  }, [data, corridor.slug, payout, amount])

  const payoutLabels = {
    bank: tm('bank'),
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    sadapay: 'SadaPay',
    nayapay: 'NayaPay',
    cash: tm('cash'),
    rda: tm('rda'),
  } as const

  const title =
    payout === 'bank'
      ? tc('titleBank')
      : payout === 'cash'
        ? tc('titleCash')
        : tc('titleNamed', { name: payoutLabels[payout] })

  const week = data?.week ?? []
  const latest = week.at(-1)?.rate ?? null
  const first = week.at(0)?.rate ?? null
  const changePercent =
    first !== null && latest !== null && first > 0 ? round(((latest - first) / first) * 100, 2) : null
  const trend =
    changePercent === null || Math.abs(changePercent) < 0.05
      ? 'flat'
      : changePercent > 0
        ? 'up'
        : 'down'

  const refreshed = comparison?.capturedAt ? REFRESHED.format(comparison.capturedAt) : null

  return (
    // Every search form on the page shares one navigation, so the results can
    // show a skeleton while a new search loads.
    <CompareNavigationProvider>
      <div className="pt-6 sm:py-8">
        <div className="mx-auto max-w-[1120px] px-6">
          {/* Keyed on the selection so a new search re-seeds the form. Phones
              get a one-line summary that opens the same form in a sheet. */}
          {/* While a new search loads the summary would still describe the old
              one, so it greys out with the rest. The row bar on wider screens
              stays live: it already shows the new choice. */}
          <WhileComparing fallback={<SummarySkeleton className="sm:hidden" />}>
            <CompareSheet
              key={`sheet-${corridor.slug}-${payout}-${amount}`}
              corridors={corridors}
              corridor={corridor.slug}
              payout={payout}
              amount={amount}
              className="sm:hidden"
            />
          </WhileComparing>
          <div className="hidden sm:block">
            <CompareSearch
              key={`${corridor.slug}-${payout}-${amount}`}
              corridors={corridors}
              initialCorridor={corridor.slug}
              initialPayout={payout}
              initialAmount={amount}
              layout="row"
            />
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-[1120px] flex-col px-6 pt-6 sm:pt-12 lg:block">
        {/* Desktop: title and details on the left, rate and alert cards on the
            right. Below lg the row dissolves (`contents`) so the cards can drop
            under the results — on a phone the list is what matters. */}
        <div className="contents lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          {/* Title, route and refresh time describe the old search until the new page lands. */}
          <WhileComparing fallback={<TitleSkeleton />}>
            <div className="min-w-0">
              <h1 className="flex items-start gap-3 text-[clamp(28px,3.2vw,34px)] leading-tight font-bold">
                {/* One line tall (leading-tight is 1.25), so the icon stays on the first line when the title wraps. */}
                <span className="flex h-[1.25em] shrink-0 items-center text-green [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-green">
                  <PayoutMethodIcon method={payout} />
                </span>
                {title}
              </h1>

              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] text-muted">
                <span>{tc('providers', { count: comparison?.rows.length ?? 0 })}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-5">
                  <CountryFlag countryCode={corridor.fromCountry} />
                  {corridor.fromCountryName}
                </span>
                <span aria-hidden="true" className="rtl:rotate-180">→</span>
                <span>{tc('pakistan')}</span>
                <span aria-hidden="true">·</span>
                <Link
                  href={staticPath('how-we-rank', locale)}
                  className="font-medium text-ink underline underline-offset-4"
                >
                  {howWeRankLabel}
                </Link>
              </p>
              {refreshed && (
                <p className="mt-1 text-[13.5px] text-muted">{tc('quotesRefreshed', { time: refreshed })}</p>
              )}
            </div>
          </WhileComparing>

          <WhileComparing fallback={<CardsSkeleton />}>
            <div className="order-last mt-10 flex shrink-0 flex-wrap gap-3 lg:order-none lg:mt-0">
              {/* min-w-0 on the card and sparkline lets the chart shrink on narrow
                  phones instead of pushing the page wider than the screen. */}
              <div className="flex min-w-0 items-center gap-3 rounded-[14px] bg-surface px-5 py-4 sm:gap-5">
                <div>
                  <div className="text-[13px] text-muted">{tc('midMarket')}</div>
                  <div className="mt-0.5 font-display text-[19px] font-semibold whitespace-nowrap tabular-nums">
                    {latest !== null ? `1 ${corridor.fromCurrency} = ${latest.toFixed(4)} PKR` : '—'}
                  </div>
                  {changePercent !== null && (
                    <div className="mt-0.5 text-[13px] text-muted">
                      {trend === 'flat' ? (
                        tc('flatThisWeek')
                      ) : (
                        <>
                          <span className={trend === 'down' ? 'text-danger' : 'text-leaf'}>
                            {trend === 'down' ? '▼' : '▲'} {Math.abs(changePercent).toFixed(1)}%
                          </span>{' '}
                          {tc('thisWeek')}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Sparkline
                  points={week}
                  width={110}
                  height={44}
                  trend={trend}
                  className={`h-auto min-w-0 shrink ${trend === 'down' ? '[&_polyline]:stroke-[#C0392B]' : '[&_polyline]:stroke-leaf'}`}
                />
              </div>

              <Link
                href={`${localePath(locale, '/')}#alerts`}
                className="flex min-w-[120px] flex-col items-center justify-center gap-1.5 rounded-[14px]
                           bg-surface px-5 py-4 text-[15px] font-medium text-ink
                           no-underline transition-shadow hover:shadow-[0_0_0_2px_var(--color-accent)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                  <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
                </svg>
                {tc('getAlerts')}
              </Link>
            </div>
          </WhileComparing>
        </div>

        <WhileComparing fallback={<ResultsSkeleton className="mt-12" />}>
          {comparison ? (
            <CompareResults
              // A new search remounts the list so it starts from the new props.
              key={`${corridor.slug}-${payout}-${amount}`}
              initial={comparison}
              payout={payout}
              payoutLabel={payoutLabels[payout]}
            />
          ) : (
            <p className="mt-12 rounded-[14px] border border-line bg-surface p-8 text-muted" role="status">
              {t('unavailable')}
            </p>
          )}
        </WhileComparing>
      </main>
    </CompareNavigationProvider>
  )
}
