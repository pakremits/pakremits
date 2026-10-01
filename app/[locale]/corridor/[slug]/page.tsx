/**
 * Corridor pages — the SEO core.
 *
 * Public URL is /compare/[slug]-to-pakistan, mapped here by a rewrite
 * in next.config.ts because Next cannot express a partial dynamic segment.
 * Every canonical, sitemap entry and internal link uses the public form; this
 * path should never be linked directly.
 */
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ComparePanel } from '@/components/compare-panel'
import { CorridorHero } from '@/components/corridor-hero'
import { HERO_ORIGINS } from '@/lib/hero/origins'
import { RateChart } from '@/components/rate-chart'
import { CountryFlag } from '@/components/select-icons'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { alternatesFor, isLocale } from '@/i18n/routing'
import {
  CORRIDORS,
  CURRENCY_SYMBOLS,
  defaultAmountFor,
  corridorBySlug,
  formatSend,
} from '@/lib/corridors'
import { CORRIDOR_CONTENT } from '@/lib/content/corridors'
import { METHOD_CONTENT } from '@/lib/content/methods'
import { methodPath } from '@/lib/routes'
import { formatPkr } from '@/lib/ranking/compute'
import { getComparison, getMidMarketSeries } from '@/lib/quotes'
import { publicPageMetadata, jsonLd } from '@/lib/seo'

export const revalidate = 900

/** All eight corridors are known at build time, so prerender the lot. */
export function generateStaticParams() {
  return CORRIDORS.map((corridor) => ({ slug: corridor.slug }))
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** The public URL for a corridor, which is what everything must point at. */
export function corridorPath(slug: string): string {
  return `/compare/${slug}-to-pakistan`
}

const TODAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  if (!isLocale(localeParam)) notFound()
  const corridor = corridorBySlug(slug)
  if (!corridor) return {}

  const content = CORRIDOR_CONTENT[corridor.fromCurrency]
  const path = corridorPath(slug)

  return publicPageMetadata({
    // Kept within ~60 characters so search results show it whole; the
    // description and the /compare URL already say it is a comparison.
    title: `Send money from ${corridor.articleName} to Pakistan | PakRemits`,
    description: content.metaDescription,
    path,
    alternates: alternatesFor(path),
    type: 'article',
    image: `/og/corridor/${slug}.png`,
  })
}

export default async function CorridorPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: localeParam, slug } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const [tCommon, tHome] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'home' }),
  ])
  const corridor = corridorBySlug(slug)
  if (!corridor) notFound()

  const content = CORRIDOR_CONTENT[corridor.fromCurrency]
  const symbol = CURRENCY_SYMBOLS[corridor.fromCurrency]

  const [comparison, series] = await Promise.all([
    getComparison({ corridorSlug: slug, method: 'bank' }),
    getMidMarketSeries(corridor.fromCurrency, 30),
  ])

  const corridorOptions = CORRIDORS.map((c) => ({
    slug: c.slug,
    countryCode: c.fromCountry,
    countryName: c.fromCountryName,
    currency: c.fromCurrency,
    symbol: CURRENCY_SYMBOLS[c.fromCurrency],
    defaultAmount: defaultAmountFor(c.fromCurrency),
  }))

  const path = corridorPath(slug)
  const saving = comparison?.savingVsBank ?? null
  const bestRate = comparison?.rows.find((row) => row.isBest)?.quote.rate ?? null
  const [lede, ...moreIntro] = content.intro
  const origin = HERO_ORIGINS[slug]
  // The home map, with only this page's arc.
  const heroCorridors = origin
    ? [
        {
          ...origin,
          href: path,
          label: corridor.fromCountryName,
          detail: bestRate === null ? undefined : `${corridor.fromCurrency} → PKR ${bestRate.toFixed(2)}`,
        },
      ]
    : []

  return (
    <>
      <SiteHeader locale={locale} />

      <main>
        {/* The home hero's map, drawn with only this corridor's two countries,
            each in its real place and size, and the arc between them. The
            legibility veil sits behind the left-aligned text; the search bar
            straddles the lower edge. */}
        <CorridorHero
          corridors={heroCorridors}
          home={{ label: tHome('heroHomeLabel') }}
          pairFrom={slug}
          // Phones and tablets get the plain gradient: no map, no pointer handling.
          wideOnly
          veilAt={{ x: 0.28, y: 0.45 }}
          className="pt-10 pb-24 text-white sm:pt-14 sm:pb-28"
        >
          <div className="relative mx-auto max-w-[1120px] px-6 lg:min-h-[420px]">
            {/* Mascot stands beside the intro, feet on the search bar top edge (48px below
                this box, plus the PNG's ~6px bottom padding); lg+ only. The min height
                keeps its horns inside the band when a corridor's intro is short. */}
            <Image
              src="/pakrimits-mascot.png"
              alt=""
              width={762}
              height={1661}
              // Not preloaded: it is hidden below lg, and a lazy image that is
              // not displayed is never fetched, so phones skip it entirely.
              sizes="230px"
              data-hero-mascot=""
              className="pointer-events-none absolute end-6 -bottom-[54px] hidden h-[480px] w-auto drop-shadow-[0_12px_24px_rgba(0,0,0,.25)] transition-[translate] duration-500 select-none motion-reduce:transition-none lg:block"
            />
            <nav aria-label="Breadcrumb" className="text-[13px] text-white/65">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="no-underline hover:text-white">
                    PakRemits
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-white/85">{corridor.fromCountryName} to Pakistan</li>
              </ol>
            </nav>

            {/* The route itself, the home map's corridor in one line: where the
                money starts, the dashed arc it travels, Pakistan, and today's
                best rate (wide screens; the list right below has it on phones).
                The chips are white in both themes, so their text is fixed ink. */}
            <p className="mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full bg-white/10 py-1.5 ps-1.5 pe-4 text-[14px] font-semibold ring-1 ring-white/20 backdrop-blur-sm sm:gap-3">
              <span className="flex items-center gap-2 rounded-full bg-white/95 py-1 ps-1.5 pe-2.5 text-[#14201b]">
                <CountryFlag countryCode={corridor.fromCountry} />
                {corridor.fromCurrency}
              </span>
              <svg viewBox="0 0 64 12" className="route-dash h-3 w-10 shrink-0 text-gold sm:w-16 rtl:-scale-x-100" aria-hidden="true">
                <path d="M1 6h56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 6" fill="none" />
                <path d="M55 2l6 4-6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="flex items-center gap-2 rounded-full bg-white/95 py-1 ps-1.5 pe-2.5 text-[#14201b]">
                <CountryFlag countryCode="PK" />
                PKR
              </span>
              {bestRate !== null && (
                <span className="hidden items-center gap-2 whitespace-nowrap text-white/80 sm:flex">
                  <span className="h-4 w-px bg-white/25" aria-hidden="true" />
                  Best today
                  <b className="font-bold text-white tabular-nums">{bestRate.toFixed(2)}</b>
                </span>
              )}
            </p>

            <h1 data-hero-copy="" className="mt-5 max-w-[18ch] font-hero text-[clamp(34px,4.6vw,54px)] leading-[1.06] font-bold tracking-[-0.03em]">
              {content.title}
            </h1>

            {/* The lead paragraph carries the page; the rest steps back. */}
            <div data-hero-copy="" className="mt-5 max-w-[58ch]">
              {lede && <p className="text-[18px] leading-relaxed text-white/90">{lede}</p>}
              {moreIntro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="mt-3 text-[15.5px] leading-relaxed text-white/70">
                  {paragraph}
                </p>
              ))}
            </div>

            {saving !== null && (
              <p className="mt-7 flex max-w-[58ch] items-center gap-3.5 rounded-[14px] bg-black/15 px-4 py-3.5 text-[15px] leading-snug text-white/85 ring-1 ring-white/15">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-on-gold" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4.5 w-4.5">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
                <span>
                  The best service here beats a typical bank by{' '}
                  <b className="font-bold whitespace-nowrap text-gold">{formatPkr(saving)}</b> on{' '}
                  {formatSend(symbol, comparison?.amount ?? 0)} today.
                </span>
              </p>
            )}
          </div>
        </CorridorHero>

        <div className="relative mx-auto -mt-14 max-w-[1120px] px-6 sm:-mt-16">
          {comparison ? (
            <ComparePanel initial={comparison} corridors={corridorOptions} switchCorridorPages />
          ) : (
            <section className="relative rounded-[22px] bg-surface p-10 shadow-[0_6px_20px_-10px_rgba(20,32,27,.12),0_1px_2px_rgba(20,32,27,.04)]">
              <h2 className="text-xl font-bold">No quotes yet</h2>
              <p className="mt-2 text-muted">
                We have no live quotes for this corridor at the moment. The refresh runs every 15
                minutes.
              </p>
            </section>
          )}
        </div>

        <div className="mx-auto max-w-[1120px] px-6">
          {/* 30-day chart */}
          <section className="mt-16">
            <RateChart
              points={series.points}
              currency={corridor.fromCurrency}
              label={`${corridor.fromCurrency} to PKR, last 30 days`}
            />
          </section>

          {/* Editorial */}
          <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_300px]">
            <article className="max-w-[68ch]">
              {locale === 'ur' && (
                /* The long-form guidance is English-only for now. Machine
                   translating several thousand words of financial guidance
                   would be worse than saying so plainly. */
                <p className="mb-6 rounded-panel border border-line bg-surface p-4 text-[14.5px] text-muted">
                  {tCommon('translationPending')}
                </p>
              )}
              {content.sections.map((section) => (
                <section key={section.heading} className="mb-10">
                  <h2 className="text-[26px] leading-tight font-semibold">{section.heading}</h2>
                  <div className="mt-3 space-y-4 text-[16.5px] text-muted">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}

              <section id="faq" className="mt-12">
                <h2 className="text-[26px] leading-tight font-semibold">Common questions</h2>
                <div className="mt-5 border-t border-line">
                  {content.faqs.map((faq, index) => (
                    <details key={faq.q} open={index === 0} className="group border-b border-line">
                      <summary
                        className="flex cursor-pointer list-none items-center justify-between gap-4
                                   py-5 text-[17px] font-medium faq-summary"
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
                      <p className="pb-5 text-[15.5px] text-muted">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </section>

              <p className="mt-8 text-[13px] text-faint">
                Guidance on this page was last reviewed on{' '}
                {TODAY.format(new Date(content.lastReviewed))}. Rates above are live; the written
                guidance is not, and rules change. Nothing here is financial advice.
              </p>
            </article>

            {/* Other corridors */}
            <aside>
              <h2 className="text-[13px] font-medium text-faint">Other corridors</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                {CORRIDORS.filter((c) => c.slug !== slug).map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={corridorPath(other.slug)}
                      className="text-ink no-underline hover:text-leaf"
                    >
                      {other.fromCountryName} to Pakistan
                    </Link>
                  </li>
                ))}
              </ul>

              <h2 className="mt-8 text-[13px] font-medium text-faint">Ways to receive</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                {METHOD_CONTENT.map((entry) => (
                  <li key={entry.slug}>
                    <Link href={methodPath(entry.slug)} className="text-ink no-underline hover:text-leaf">
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <h2 className="mt-8 text-[13px] font-medium text-faint">Rates</h2>
              <ul className="mt-3.5 grid gap-2 text-[15px]">
                <li>
                  <Link
                    href={`/${corridor.fromCurrency.toLowerCase()}-to-pkr`}
                    className="text-ink no-underline hover:text-leaf"
                  >
                    {corridor.fromCurrency} to PKR rate today
                  </Link>
                </li>
                <li>
                  <Link href="/how-we-rank" className="text-ink no-underline hover:text-leaf">
                    How we rank providers
                  </Link>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: content.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'PakRemits', item: SITE },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: `${corridor.fromCountryName} to Pakistan`,
                  item: `${SITE}${path}`,
                },
              ],
            },
          ]),
        }}
      />
    </>
  )
}
