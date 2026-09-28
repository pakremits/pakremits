import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CompareSearch } from '@/components/compare-search'
import { CorridorHero } from '@/components/corridor-hero'
import { HERO_ORIGINS } from '@/lib/hero/origins'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { eq } from 'drizzle-orm'
import { CORRIDORS, CURRENCY_SYMBOLS, defaultAmountFor, formatSend } from '@/lib/corridors'
import { getBestRatePerCorridor, getComparison, getMidMarketSeries } from '@/lib/quotes'
import { db } from '@/lib/db'
import { providers as providersTable } from '@/lib/db/schema'
import type { SendCurrency } from '@/lib/db/schema'
import { notFound } from 'next/navigation'
import { alternatesFor, isLocale, localePath } from '@/i18n/routing'
import { corridorPath } from '@/lib/routes'
import { RateAlertCta } from '@/components/rate-alert-cta'
import { RateMarquee } from '@/components/rate-marquee'
import { CountryFlag } from '@/components/select-icons'
import { PayoutGuide } from '@/components/payout-guide'
import { PROOF_CARD, ProofStrip } from '@/components/proof-strip'
import { ProviderRoster, type RosterProvider } from '@/components/provider-roster'
import { RateChart } from '@/components/rate-chart'
import { TodaysExample } from '@/components/todays-example'
import { PAYOUT_OPTIONS } from '@/lib/payout'
import { getProofStats } from '@/lib/proof/stats'
import { CLAIM_FIRST_PAKISTAN_ONLY_SITE } from '@/lib/proof/config'
import { publicPageMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  if (!isLocale(localeParam)) notFound()
  return publicPageMetadata({
    title: 'Compare money transfer rates to Pakistan | PakRemits',
    description: 'Compare exchange rates and fees for sending money to Pakistan from the UK, UAE, Saudi Arabia, USA, Canada, Australia, Qatar and Europe. See what arrives in PKR.',
    path: '/',
    alternates: alternatesFor('/'),
  })
}

// Quotes change every 15 minutes; the GitHub Actions job pings /api/cron/revalidate
// after each refresh, and this is the backstop if that ping is ever missed.
export const revalidate = 900


/**
 * The hero form opens on $1,000 from the USA, and the worked example, payout
 * guide and chart follow it. 1,000 is one of USD's standard amounts, so the
 * example always has fresh quotes.
 */
const EXAMPLE_CORRIDOR = CORRIDORS.find((corridor) => corridor.slug === 'usa') ?? CORRIDORS[0]
const EXAMPLE_AMOUNT = 1000

/** Active, real providers for the roster. Empty (and the section hidden) if the DB is down. */
async function listRosterProviders(): Promise<RosterProvider[]> {
  try {
    const rows = await db
      .select({
        slug: providersTable.slug,
        name: providersTable.name,
        brandColor: providersTable.brandColor,
        brandTextColor: providersTable.brandTextColor,
        isBenchmark: providersTable.isBenchmark,
      })
      .from(providersTable)
      .where(eq(providersTable.active, true))
      .orderBy(providersTable.name)
    return rows.filter((row) => !row.isBenchmark)
  } catch (error) {
    // The lazy DB proxy can throw before a promise exists, e.g. with no DATABASE_URL at build.
    console.error('[home] provider roster failed:', error)
    return []
  }
}

const COUNTRY_BY_CURRENCY = new Map(
  CORRIDORS.map((corridor) => [corridor.fromCurrency, corridor.fromCountry]),
)

/**
 * These small marks appear in the search form's payout dropdown.
 * Resource hints start fetching them with the initial document so opening a
 * selector never has to wait for an image request.
 */
const COMPARISON_IMAGE_ASSETS = [
  '/payout-icons/jazzcash.png',
  '/payout-icons/easypaisa.png',
  '/payout-icons/sadapay.png',
  '/payout-icons/nayapay.png',
  '/payout-icons/rda.png',
] as const


export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'home' })
  const tProof = await getTranslations({ locale, namespace: 'proof' })
  const tPanel = await getTranslations({ locale, namespace: 'panel' })
  const tAlerts = await getTranslations({ locale, namespace: 'alerts' })
  const tNav = await getTranslations({ locale, namespace: 'nav' })

  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
    { q: t('faq6Q'), a: t('faq6A') },
  ]

  const [chips, series, example, proofStats, rosterProviders, exampleSeries] = await Promise.all([
    getBestRatePerCorridor(),
    // Every corridor currency: the marquee carries a 7-day trend chip per
    // sending country.
    Promise.all(CORRIDORS.map((corridor) => getMidMarketSeries(corridor.fromCurrency, 7))),
    getComparison({ corridorSlug: EXAMPLE_CORRIDOR.slug, amount: EXAMPLE_AMOUNT }),
    getProofStats(),
    listRosterProviders(),
    getMidMarketSeries(EXAMPLE_CORRIDOR.fromCurrency, 30),
  ])

  const exampleSendLabel = formatSend(CURRENCY_SYMBOLS[EXAMPLE_CORRIDOR.fromCurrency], EXAMPLE_AMOUNT)
  const exampleCompareHref = `${localePath(locale, '/compare')}?${new URLSearchParams({
    from: EXAMPLE_CORRIDOR.slug,
    to: 'bank',
    amount: String(EXAMPLE_AMOUNT),
  })}`

  const seriesByCurrency = new Map(series.map((entry) => [entry.currency, entry]))

  const marqueeItems = chips.map((chip) => ({
    ...chip,
    changePercent: seriesByCurrency.get(chip.currency)?.changePercent ?? null,
  }))

  const corridorOptions = CORRIDORS.map((corridor) => ({
    slug: corridor.slug,
    countryCode: corridor.fromCountry,
    countryName: corridor.fromCountryName,
    currency: corridor.fromCurrency,
    defaultAmount: defaultAmountFor(corridor.fromCurrency),
  }))

  const heroCorridors = chips.flatMap((chip) => {
    const origin = HERO_ORIGINS[chip.slug]
    if (!origin) return []
    return [
      {
        ...origin,
        href: corridorPath(chip.slug, locale),
        label: chip.countryName,
        detail:
          chip.bestRate === null ? undefined : `${chip.currency} → PKR ${chip.bestRate.toFixed(2)}`,
      },
    ]
  })

  return (
    <>
      {COMPARISON_IMAGE_ASSETS.map((href) => (
        <link key={href} rel="preload" as="image" href={href} type="image/png" />
      ))}

      <SiteHeader locale={locale} />

      {/* The band is an interactive map of the corridors; hover a country for
          today's best rate, click it to open that corridor. */}
      <CorridorHero
        corridors={heroCorridors}
        home={{
          label: t('heroHomeLabel'),
          detail: t('heroHomeDetail', { count: heroCorridors.length }),
        }}
        className="pt-6 pb-[30px] short-phone:pt-4 sm:pt-20">

        <div className="relative mx-auto max-w-[980px] px-6 text-center text-white">
          {/* Off by default. See CLAIM_FIRST_PAKISTAN_ONLY_SITE — it must not
              be enabled until someone has actually run the competitor check. */}
          {CLAIM_FIRST_PAKISTAN_ONLY_SITE && (
            <p className="mb-3 text-[13px] tracking-wide text-gold uppercase">
              {tProof('firstPakistanOnlySite')}
            </p>
          )}

          <h1 className="mx-auto max-w-[20ch] font-hero text-[30px] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[clamp(36px,5vw,62px)] sm:leading-[1.08]">
            {t('heroTitle')}
          </h1>

          <p className="mx-auto mt-3 max-w-[62ch] text-[15px] leading-normal text-white/90 short-phone:mt-2 short-phone:text-[14px] sm:mt-5 sm:text-lg sm:leading-relaxed">
            {t('heroLede')}
          </p>
        </div>

        <div id="compare" className="relative z-[2] mx-auto mt-6 max-w-[900px] px-4 short-phone:mt-4 sm:mt-14 sm:px-6 lg:mt-[46px]">
          <h2 className="sr-only">{tPanel('heading')}</h2>
          <CompareSearch
            corridors={corridorOptions}
            initialCorridor={EXAMPLE_CORRIDOR.slug}
            initialAmount={EXAMPLE_AMOUNT}
          />
        </div>
      </CorridorHero>

      <main className="mx-auto max-w-[1120px] px-6">
        {/* Corridor marquee — full-bleed, so it sits outside the column. */}
        <RateMarquee locale={locale} items={marqueeItems} />

        {/* One real comparison, drawn as rupees received. */}
        <TodaysExample
          locale={locale}
          comparison={example}
          countryName={EXAMPLE_CORRIDOR.fromCountryName}
          sendLabel={exampleSendLabel}
          compareHref={exampleCompareHref}
        />

        <section id="trust" className="mt-16" aria-labelledby="trust-cards-title">
          <div className="max-w-[54ch]">
            <h2
              id="trust-cards-title"
              className="text-[clamp(28px,3.5vw,34px)] leading-[1.1] font-semibold"
            >
              {t('trustTitle')}
            </h2>
            <p className="mt-3 text-[16px] text-muted">{t('trustLede')}</p>
          </div>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                value: t('trustRouteValue'),
                title: t('trustRouteTitle'),
                body: t('trustRouteBody'),
                path: 'M7 12.5 10.2 16 17.5 8.5M4 5h16v14H4z',
              },
              {
                value: t('trustRefreshValue'),
                title: t('trustRefreshTitle'),
                body: t('trustRefreshBody'),
                path: 'M12 7v5l3 2M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
              },
              {
                value: t('trustRankingValue'),
                title: t('trustRankingTitle'),
                body: t('trustRankingBody'),
                path: 'M5 18V9m7 9V5m7 13v-6M3 21h18',
              },
              {
                value: t('trustPayoutValue'),
                title: t('trustPayoutTitle'),
                body: t('trustPayoutBody'),
                path: 'M3 9h18L12 4 3 9Zm2 2v6m4-6v6m6-6v6m4-6v6M3 20h18',
              },
            ].map((card) => (
              <li
                key={card.title}
                className="flex min-h-60 flex-col rounded-[10px] bg-surface p-6"
              >
                <div className="grid h-10 w-10 place-items-center rounded-[11px] bg-icon-bg text-leaf">
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
                    <path d={card.path} />
                  </svg>
                </div>
                <div className="mt-5 min-h-9 font-display text-[25px] leading-tight font-semibold tracking-[-0.02em] text-green">
                  {card.value}
                </div>
                <h3 className="mt-2 text-[15px] font-semibold text-ink">{card.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{card.body}</p>
              </li>
            ))}
          </ul>

          {/* The live gap already has its own section above, so it is not repeated here. */}
          <ProofStrip
            locale={locale}
            stats={proofStats}
            liveGapOnStandardAmount={null}
            sendAmountLabel={exampleSendLabel}
          >
            <li className={PROOF_CARD}>
              <p className="text-[15px] leading-[1.4] font-medium text-ink">
                {tProof('proofCountries', {
                  countries: CORRIDORS.length,
                  payouts: PAYOUT_OPTIONS.length,
                })}
              </p>
            </li>
          </ProofStrip>
        </section>

        {/* Why our ranking is different */}
        <section id="how" className="mt-24">
          {/* Width cap only below lg; on desktop the <br> sets the two-line break. */}
          <div className="max-w-[44ch] lg:max-w-none">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              {t.rich('whyTitle', { br: () => <br className="hidden lg:block" /> })}
            </h2>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: t('cardRankedTitle'),
                body: t('cardRankedBody'),
                path: 'M4 19h16M6 15V9m4 6V5m4 10v-4m4 4V7',
              },
              {
                title: t('cardPakistanTitle'),
                body: t('cardPakistanBody'),
                path: 'M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12a9 9 0 0018 0 9 9 0 00-18 0z',
              },
              {
                title: t('cardBonusTitle'),
                body: t('cardBonusBody'),
                path: 'M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-panel bg-surface p-7">
                <div className="mb-4.5 grid h-11 w-11 place-items-center rounded-[12px] bg-icon-bg text-leaf">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5.5 w-5.5"
                    aria-hidden="true"
                  >
                    <path d={card.path} />
                  </svg>
                </div>
                <h3 className="mb-2 text-[19px] font-semibold">{card.title}</h3>
                <p className="text-[15px] text-muted">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Every service in the comparison. */}
        <ProviderRoster locale={locale} providers={rosterProviders} />

        {/* Corridors. Full-bleed like the marquee: a mint band in the light
            theme, the usual dark band in the dark one. */}
        <section
          id="corridors"
          className="ms-[calc(50%-50vw)] mt-16 w-screen bg-[#d9eddf82] py-16 dark:bg-band"
        >
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="max-w-[44ch]">
              <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
                {t('corridorsTitle')}
              </h2>
              <p className="mt-3 text-[17px] text-muted">
                {t('corridorsLede')}
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {chips.map((chip) => (
                <Link
                  key={chip.slug}
                  href={corridorPath(chip.slug, locale)}
                  // isolate: the watermark's z-index stays inside the card.
                  className="flag-host group/cc relative isolate flex min-h-[148px] flex-col overflow-hidden rounded-[14px]
                             bg-surface p-5 text-ink no-underline focus-visible:outline-none dark:bg-header
                             focus-visible:ring-[3px] focus-visible:ring-accent"
                >
                  {/* The same flag watermark as the rate ticker, cropped into the
                      top corner and faded towards the name. */}
                  <span className="flag-mark flag-mark--corner" aria-hidden="true">
                    <CountryFlag
                      countryCode={COUNTRY_BY_CURRENCY.get(chip.currency as SendCurrency) ?? 'EU'}
                    />
                  </span>

                  <span className="flex items-center gap-3 text-[15px] font-medium">
                    <span className="grid h-8 w-9 place-items-center" aria-hidden="true">
                      <CountryFlag
                        countryCode={COUNTRY_BY_CURRENCY.get(chip.currency as SendCurrency) ?? 'EU'}
                      />
                    </span>
                    {chip.countryName}
                  </span>

                  {/* The rate is the reason to click, so it leads. */}
                  <span className="mt-auto flex items-end justify-between gap-3 pt-6">
                    <span>
                      <b className="block font-display text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                        {chip.bestRate?.toFixed(2) ?? '—'}
                      </b>
                      <span className="mt-2 block text-[12.5px] text-muted">
                        {t('bestToday')}
                        <span className="ms-1.5 text-faint" dir="ltr">
                          {chip.currency} → PKR
                        </span>
                      </span>
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="mb-1 h-5 w-5 shrink-0 -translate-x-1 text-tint-ink opacity-0 transition-[opacity,translate]
                                 group-hover/cc:translate-x-0 group-hover/cc:opacity-100
                                 group-focus-visible/cc:translate-x-0 group-focus-visible/cc:opacity-100
                                 rtl:rotate-180 rtl:translate-x-1 motion-reduce:transition-none"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Payout rails, after the country picker: where from, then where to. */}
        <PayoutGuide locale={locale} corridor={EXAMPLE_CORRIDOR.slug} amount={EXAMPLE_AMOUNT} />

        {/* Rate alerts, with the trend they would be watching. Opens the dialog. */}
        <RateAlertCta
          locale={locale}
          title={tAlerts('dialogTitle')}
          body={tAlerts('ctaBody')}
          button={tNav('setAlert')}
          className="mt-24"
          aside={
            <RateChart
              points={exampleSeries.points}
              currency={EXAMPLE_CORRIDOR.fromCurrency}
              label={t('alertChartLabel', { currency: EXAMPLE_CORRIDOR.fromCurrency })}
              height={200}
              bare
            />
          }
        />

        {/* FAQ */}
        <section id="faq" className="mt-24">
          <div className="max-w-[44ch]">
            <h2 className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
              {t('faqTitle')}
            </h2>
          </div>

          <div className="mt-7 border-t border-line">
            {faqs.map((faq, index) => (
              <details key={faq.q} open={index === 0} className="group border-b border-line">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 py-5
                             text-[17px] font-medium faq-summary"
                >
                  {faq.q}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4.5 w-4.5 flex-none text-muted transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="max-w-[70ch] pb-5 text-[15.5px] text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />

      {/* FAQPage schema so the questions can win a rich result. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }),
        }}
      />
    </>
  )
}
