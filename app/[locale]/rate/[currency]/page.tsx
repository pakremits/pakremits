/**
 * Rate pages — /gbp-to-pkr and friends, via a rewrite in next.config.ts.
 *
 * These are the daily-repeat-visit pages: someone checking whether today is a
 * good day to send. So the rate itself is the entire top of the page, and the
 * comparison is one scroll below it rather than the other way round.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RateChart } from '@/components/rate-chart'
import { ProviderLogo } from '@/components/provider-logo'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { alternatesFor, isLocale } from '@/i18n/routing'
import { CORRIDORS, CURRENCY_SYMBOLS, corridorByCurrency, formatSend } from '@/lib/corridors'
import { SEND_CURRENCIES, type SendCurrency } from '@/lib/db/schema'
import { formatPkr, round } from '@/lib/ranking/compute'
import { getComparison, getMidMarketHistory, getMidMarketSeries } from '@/lib/quotes'
import { RateBackdrop } from '@/components/rate-backdrop'
import { corridorPath } from '@/lib/routes'
import { publicPageMetadata, jsonLd } from '@/lib/seo'

export const revalidate = 900

export function generateStaticParams() {
  return SEND_CURRENCIES.map((currency) => ({ currency: currency.toLowerCase() }))
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Parse the URL segment back into a currency code, or null if unknown. */
function parseCurrency(segment: string): SendCurrency | null {
  const upper = segment.toUpperCase() as SendCurrency
  return SEND_CURRENCIES.includes(upper) ? upper : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; currency: string }>
}): Promise<Metadata> {
  const { locale: localeParam, currency: segment } = await params
  if (!isLocale(localeParam)) notFound()
  const currency = parseCurrency(segment)
  if (!currency) return {}

  const path = `/${currency.toLowerCase()}-to-pkr`

  const corridor = corridorByCurrency(currency)!
  return publicPageMetadata({
    title: `${currency} to PKR exchange rate and transfer comparison | PakRemits`,
    description: `Check the ${currency} to PKR exchange rate, rate history and available transfer quotes from ${corridor.articleName} to Pakistan. Compare fees and rupees received.`,
    path,
    alternates: alternatesFor(path),
    // The same country's corridor card: flag, route and today's best rate.
    image: `/og/corridor/${corridor.slug}.png`,
  })
}

export default async function RatePage({ params }: { params: Promise<{ locale: string; currency: string }> }) {
  const { locale: localeParam, currency: segment } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const currency = parseCurrency(segment)
  if (!currency) notFound()

  const corridor = corridorByCurrency(currency)
  if (!corridor) notFound()

  const symbol = CURRENCY_SYMBOLS[currency]

  const [series90, history, comparison] = await Promise.all([
    getMidMarketSeries(currency, 90),
    getMidMarketHistory(currency, 90),
    getComparison({ corridorSlug: corridor.slug, method: 'bank' }),
  ])
  // The banner's gold line: the last 30 days.
  const backdropFrom = (history.daily.at(-1)?.t ?? 0) - 30 * 24 * 60 * 60 * 1000
  const backdropPoints = history.daily.filter((point) => point.t >= backdropFrom)

  const latest = series90.latest
  const best = comparison?.rows.find((r) => r.isBest)

  /**
   * Change over a window, or null when we do not have enough history to
   * answer honestly.
   *
   * Falling back to the oldest point we happen to hold would label 30 days of
   * data as a 90-day change, which is a made-up number on a page whose entire
   * job is accurate rates. A window is only reported when the series reaches
   * back over at least 80% of it; otherwise the reader sees a dash.
   */
  function changeOver(days: number): number | null {
    const points = series90.points
    if (points.length < 2) return null

    const windowMs = days * 24 * 60 * 60 * 1000
    const oldest = points[0]
    const to = points[points.length - 1]

    const coveredMs = to.date.getTime() - oldest.date.getTime()
    if (coveredMs < windowMs * 0.8) return null

    const cutoff = to.date.getTime() - windowMs
    const from = points.find((p) => p.date.getTime() >= cutoff) ?? oldest
    if (from.rate <= 0) return null

    return round(((to.rate - from.rate) / from.rate) * 100, 2)
  }

  const windows = [
    { label: '7 days', value: changeOver(7) },
    { label: '30 days', value: changeOver(30) },
    { label: '90 days', value: changeOver(90) },
  ]


  return (
    <>
      <SiteHeader locale={locale} />

      <main>
        {/* The home banner's gradient, with the last month's rate drawn in gold
            along its foot. Taller than the text needs, to give the line room. */}
        <div className="hero-gradient relative overflow-hidden px-0 pt-12 pb-44 text-white sm:pt-14 sm:pb-52">
          <RateBackdrop
            points={backdropPoints}
            className="absolute inset-x-0 bottom-0 h-[170px] w-full sm:h-[230px]"
          />
          <div className="relative mx-auto max-w-[1120px] px-6">
            <nav aria-label="Breadcrumb" className="text-[13px] text-white/70">
              <ol className="flex items-center gap-2">
                <li>
                  <Link href="/" className="no-underline hover:text-white">
                    PakRemits
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-white/90">{currency} to PKR</li>
              </ol>
            </nav>

            <h1 className="mt-5 text-[clamp(30px,4vw,44px)] leading-[1.05] font-semibold">
              {currency} to PKR rate today
            </h1>

            <div className="mt-7 flex flex-wrap items-end gap-x-12 gap-y-6">
              <div>
                <div className="font-display text-[clamp(48px,8vw,84px)] leading-none font-semibold tabular-nums text-white">
                  {latest?.toFixed(2) ?? '—'}
                </div>
                <p className="mt-2 max-w-[60ch] text-[15px] text-white/80">
                  Mid-market reference for 1 {currency}. No provider gives you this rate — it is the
                  line they are measured against.
                </p>
              </div>

              <dl className="flex gap-8">
                {windows.map((window) => (
                  <div key={window.label}>
                    <dt className="text-[13px] text-white/70">{window.label}</dt>
                    <dd
                      className="mt-1 font-display text-xl font-semibold tabular-nums"
                      style={{
                        color:
                          window.value === null
                            ? 'rgba(255,255,255,.7)'
                            : window.value >= 0
                              ? 'var(--color-up)'
                              : 'var(--color-down)',
                      }}
                    >
                      {window.value === null
                        ? '—'
                        : `${window.value >= 0 ? '+' : ''}${window.value.toFixed(2)}%`}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1120px] px-6">
          {/* Best right now */}
          {best && comparison && (
            <section className="relative -mt-14 rounded-panel-lg border border-line bg-surface p-7 shadow-[0_40px_80px_-40px_rgba(2,78,56,.35)]">
              <h2 className="text-[13px] font-medium text-faint">Best right now</h2>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <ProviderLogo
                    providerSlug={best.quote.providerSlug}
                    providerName={best.quote.providerName}
                    brandColor={best.quote.brandColor}
                    brandTextColor={best.quote.brandTextColor}
                    size="large"
                  />
                  <div>
                    <div className="text-lg font-medium">{best.quote.providerName}</div>
                    <div className="text-[13.5px] text-muted">
                      {best.quote.rate.toFixed(2)} per {symbol} · {best.quote.deliverySpeedText}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-display text-[28px] leading-none font-semibold tabular-nums">
                    {formatPkr(best.quote.amountReceived)}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    on {formatSend(symbol, comparison.amount)}
                  </div>
                </div>

                <Link
                  href={corridorPath(corridor.slug)}
                  className="flex h-11 items-center rounded-control bg-brand px-5 font-medium text-white no-underline hover:bg-brand-hover"
                >
                  Compare all services
                </Link>
              </div>
            </section>
          )}

          <section className="mt-14">
            <RateChart history={history} currency={currency} title={`${currency} to PKR`} defaultRange="all" height={280} />
          </section>

          <section className="mt-14 max-w-[68ch]">
            <h2 className="text-[26px] leading-tight font-semibold">
              What moves the {currency} to PKR rate
            </h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              {['AED', 'SAR', 'QAR'].includes(currency) ? (
                <p>
                  The {corridor.fromCountryName} currency is pegged to the US dollar, so this pair
                  moves almost entirely with the rupee rather than with the {currency}. When you
                  see this rate change, it is the rupee that moved. Watching the dollar-rupee rate
                  tells you effectively everything about when to send.
                </p>
              ) : (
                <p>
                  Both sides of this pair float, so the rate moves for two independent reasons: the{' '}
                  {currency} strengthening or weakening against the dollar, and the rupee doing the
                  same. A good rate for you can come from either, which is why the 90-day chart is
                  more useful here than a single day’s number.
                </p>
              )}
              <p>
                On the Pakistani side the rupee responds to the country’s foreign reserves, the
                current account balance, and State Bank policy. Remittance inflows themselves are
                one of the largest supports for the currency, which is part of why the State Bank
                subsidises the channels this site compares.
              </p>
              <p>
                The practical advice is unglamorous: the rate matters less than which service you
                use. The spread between the best and worst option on any given day is routinely
                larger than a month of rate movement, so comparing providers beats timing the
                market for almost everyone.
              </p>
            </div>
          </section>

          <section className="mt-12 max-w-[68ch]">
            <h2 className="text-[26px] leading-tight font-semibold">Other rates</h2>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-[15px] sm:grid-cols-3">
              {CORRIDORS.filter((c) => c.fromCurrency !== currency).map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/${other.fromCurrency.toLowerCase()}-to-pkr`}
                    className="text-ink no-underline hover:text-leaf"
                  >
                    {other.fromCurrency} to PKR
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter locale={locale} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'PakRemits', item: SITE },
              {
                '@type': 'ListItem',
                position: 2,
                name: `${currency} to PKR`,
                item: `${SITE}/${currency.toLowerCase()}-to-pkr`,
              },
            ],
          }),
        }}
      />
    </>
  )
}
