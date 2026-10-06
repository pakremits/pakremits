/**
 * Provider pages.
 *
 * The live rate across every corridor is the substance here — it is the one
 * thing a provider's own marketing page will never show you, and the reason
 * someone would read this rather than the provider's site.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { ProviderLogo } from '@/components/provider-logo'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { refreshCadence } from '@/lib/cadence'
import { CORRIDORS, CURRENCY_SYMBOLS, formatSend } from '@/lib/corridors'
import { db } from '@/lib/db'
import { providers } from '@/lib/db/schema'
import { formatPkr } from '@/lib/ranking/compute'
import { getComparison } from '@/lib/quotes'
import { providerAvailability, providerSupportsCorridor } from '@/lib/providers/availability'
import { comparePath, corridorPath } from '@/lib/routes'
import { getProviderCoverage, strongPairs } from '@/lib/coverage'
import { publicPageMetadata, jsonLd } from '@/lib/seo'

/** A page per active provider, built with the site; any other slug is a 404. */
export const dynamicParams = false

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: providers.slug })
    .from(providers)
    .where(and(eq(providers.active, true), eq(providers.isBenchmark, false)))
  return rows.map((row) => ({ slug: row.slug }))
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const RAILS = [
  { key: 'supportsBank', label: 'Bank account deposit' },
  { key: 'supportsWallet', label: 'JazzCash and Easypaisa' },
  { key: 'supportsNeobank', label: 'Sadapay and Nayapay' },
  { key: 'supportsCash', label: 'Cash pickup' },
  { key: 'supportsRda', label: 'Roshan Digital Account' },
] as const

/**
 * Unguarded: a database error fails the build, so the site keeps serving the
 * last good copy of this page rather than a broken one.
 */
async function getProvider(slug: string) {
  const [row] = await db.select().from(providers).where(eq(providers.slug, slug)).limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const provider = await getProvider(slug)
  if (!provider) return {}

  const availability = providerAvailability(slug)
  // No live quote anywhere: the page is mostly "not available" rows.
  const coverage = await getProviderCoverage()
  const quoted = (coverage.get(slug)?.size ?? 0) > 0

  return publicPageMetadata({
    // Not "money transfer rates": several names already end in "Money
    // Transfer" or "Exchange", which made the title repeat itself.
    title: `${provider.name} to Pakistan: rates and fees | PakRemits`,
    description: availability
      ? `See which countries ${provider.name} sends money to Pakistan from, the payout methods it supports, and how its live rates compare with other services.`
      : `Compare ${provider.name}'s exchange rate and fees for sending money to Pakistan with other services, and see exactly how many rupees arrive.`,
    path: `/providers/${slug}`,
    index: quoted,
  })
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const locale = DEFAULT_LOCALE
  setRequestLocale(locale)
  const provider = await getProvider(slug)
  if (!provider || !provider.active || provider.isBenchmark) notFound()

  // Live rate for this provider in every corridor it serves.
  const perCorridor = await Promise.all(
    CORRIDORS.map(async (corridor) => {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        method: 'bank',
        includeBenchmark: false,
      })
      const row = comparison?.rows.find((r) => r.quote.providerSlug === slug)
      const best = comparison?.rows.find((r) => r.isBest)

      return {
        corridor,
        row,
        isBest: row && best ? row.quote.providerSlug === best.quote.providerSlug : false,
        gapToBest: row && best ? row.quote.amountReceived - best.quote.amountReceived : null,
        amount: comparison?.amount ?? null,
      }
    }),
  )

  const served = perCorridor.filter((entry) => entry.row)

  // Head-to-heads worth reading: other services this one meets in at least
  // two corridors. These are the only links into those pages.
  const coverage = await getProviderCoverage()
  const rivalSlugs = strongPairs(coverage)
    .filter(([a, b]) => a === slug || b === slug)
    .map(([a, b]) => (a === slug ? b : a))
  const rivals = rivalSlugs.length
    ? (await db.select({ slug: providers.slug, name: providers.name }).from(providers)).filter((row) =>
        rivalSlugs.includes(row.slug),
      )
    : []
  const winning = served.filter((entry) => entry.isBest).length
  const availability = providerAvailability(slug)

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="no-underline hover:text-leaf">
                PakRemits
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/providers" className="no-underline hover:text-leaf">
                Providers
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">{provider.name}</li>
          </ol>
        </nav>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          <ProviderLogo
            providerSlug={provider.slug}
            providerName={provider.name}
            brandColor={provider.brandColor}
            brandTextColor={provider.brandTextColor}
            size="hero"
          />
          <h1 className="text-[clamp(30px,4vw,44px)] leading-tight font-semibold">
            {provider.name} for sending to Pakistan
          </h1>
        </div>

        <p className="mt-5 max-w-[62ch] text-[17px] text-muted">
          {served.length === 0 ? (
            <>
              We do not currently have live quotes for {provider.name}. Its supported sending
              routes are shown below, but it will enter the rate ranking only when we can obtain a
              genuine rate and fee without working around its site.
            </>
          ) : (
            <>
              We have live quotes for {provider.name} in {served.length} of our{' '}
              {CORRIDORS.length} corridors.{' '}
              {winning > 0
                ? `Right now it pays the most rupees in ${winning} of them.`
                : 'Right now another service pays more in every one of them.'}{' '}
              Rates below are refreshed {refreshCadence()}.
            </>
          )}
        </p>

        {/* Live rate across corridors */}
        <section className="mt-10">
          <h2 className="text-[26px] leading-tight font-semibold">Live rates by corridor</h2>

          <div className="mt-4 overflow-x-auto rounded-panel border border-line bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th className="p-4 font-medium">Corridor</th>
                  <th className="p-4 text-right font-medium">Rate</th>
                  <th className="p-4 text-right font-medium">Fee</th>
                  <th className="p-4 text-right font-medium">Recipient gets</th>
                  <th className="p-4 text-right font-medium">Against the best</th>
                </tr>
              </thead>
              <tbody>
                {perCorridor.map((entry) => {
                  const symbol = CURRENCY_SYMBOLS[entry.corridor.fromCurrency]

                  return (
                    <tr
                      key={entry.corridor.slug}
                      className="border-b border-line-2 last:border-0"
                    >
                      <td className="p-4">
                        <Link
                          href={corridorPath(entry.corridor.slug)}
                          className="text-ink no-underline hover:text-leaf"
                        >
                          {entry.corridor.fromCountryName}
                        </Link>
                        <span className="ml-2 text-[13px] text-faint">
                          {entry.corridor.fromCurrency}
                        </span>
                      </td>

                      {entry.row ? (
                        <>
                          <td className="p-4 text-right tabular-nums">
                            {entry.row.quote.rate.toFixed(2)}
                          </td>
                          <td className="p-4 text-right tabular-nums">
                            {formatSend(symbol, entry.row.quote.fee.toFixed(2))}
                          </td>
                          <td className="p-4 text-right font-medium tabular-nums">
                            {formatPkr(entry.row.quote.amountReceived)}
                            {entry.amount !== null && (
                              <small className="block text-xs font-normal text-faint">
                                on {formatSend(symbol, entry.amount)}
                              </small>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {entry.isBest ? (
                              <span className="rounded-full bg-gold px-2.5 py-1 text-[11.5px] font-medium text-[#4A3608]">
                                Best deal
                              </span>
                            ) : (
                              <span className="text-[13.5px] tabular-nums text-muted">
                                {entry.gapToBest !== null
                                  ? `${formatPkr(Math.abs(entry.gapToBest))} behind`
                                  : '—'}
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="p-4 text-right text-[13.5px] text-faint">
                          {providerSupportsCorridor(slug, entry.corridor.slug)
                            ? 'Supported — live quote unavailable'
                            : availability
                              ? 'Not supported online'
                              : 'Live quote unavailable'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="text-[26px] leading-tight font-semibold">What it supports</h2>
            <ul className="mt-4 grid gap-2.5 text-[16px]">
              {RAILS.map((rail) => {
                const supported = provider[rail.key]
                return (
                  <li key={rail.key} className="flex items-center gap-2.5">
                    <span
                      className={`grid h-5 w-5 flex-none place-items-center rounded-full ${
                        supported ? 'bg-icon-bg text-leaf' : 'bg-line-2 text-faint'
                      }`}
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="h-2.5 w-2.5"
                      >
                        <path d={supported ? 'M4 12l6 6L20 6' : 'M6 6l12 12M18 6L6 18'} />
                      </svg>
                    </span>
                    <span className={supported ? 'text-ink' : 'text-faint line-through'}>
                      {rail.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {rivals.length > 0 && (
            <section>
              <h2 className="text-[26px] leading-tight font-semibold">
                Compare {provider.name} head to head
              </h2>
              <ul className="mt-4 grid gap-2 text-[16px] sm:grid-cols-2">
                {rivals.map((rival) => (
                  <li key={rival.slug}>
                    <Link
                      href={comparePath(slug, rival.slug, locale)}
                      className="text-leaf underline underline-offset-2 hover:text-leaf-dark"
                    >
                      {provider.name} vs {rival.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-[26px] leading-tight font-semibold">How we make money from this</h2>
            <p className="mt-4 text-[16px] text-muted">
              {provider.affiliateUrlTemplate
                ? provider.commissionNote ??
                  `We earn a commission when a new customer signs up with ${provider.name} through our link.`
                : `We currently earn nothing from ${provider.name}. Links to them are plain links to their site.`}{' '}
              Either way it has no effect on where they appear in any table —{' '}
              <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
                the ranking function has no commission input at all
              </Link>
              .
            </p>

            {provider.homepageUrl && (
              <a
                href={`/go/${provider.slug}`}
                rel="sponsored nofollow"
                className="mt-6 inline-flex h-12 items-center rounded-control bg-[#14201b] px-6 font-medium text-white no-underline hover:bg-black dark:bg-[#f2f2f0] dark:text-[#14201b] dark:hover:bg-white"
              >
                Visit {provider.name}
              </a>
            )}
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
              { '@type': 'ListItem', position: 2, name: 'Providers', item: `${SITE}/providers` },
              {
                '@type': 'ListItem',
                position: 3,
                name: provider.name,
                item: `${SITE}/providers/${provider.slug}`,
              },
            ],
          }),
        }}
      />
    </>
  )
}
