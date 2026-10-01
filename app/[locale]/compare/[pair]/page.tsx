/**
 * Head-to-head comparison pages, e.g. /compare/wise-vs-remitly.
 *
 * These target the "X vs Y" search, which is high-intent and usually served by
 * content written before either provider's current pricing existed. Ours is
 * computed from today's quotes across every corridor, so the verdict changes
 * when the market does.
 *
 * Pairs are generated from providers that actually have quotes, so a pair page
 * never exists for a provider we cannot price.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { isLocale } from '@/i18n/routing'
import { CORRIDORS, CURRENCY_SYMBOLS, formatSend } from '@/lib/corridors'
import { db } from '@/lib/db'
import { providers, rateQuotes } from '@/lib/db/schema'
import { formatPkr } from '@/lib/ranking/compute'
import { getComparison } from '@/lib/quotes'
import { corridorPath } from '@/lib/routes'
import { publicPageMetadata, jsonLd } from '@/lib/seo'

export const revalidate = 900

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Providers with at least one stored quote, ordered for stable pairing. */
async function quotableProviders() {
  return db
    .selectDistinct({ slug: providers.slug, name: providers.name })
    .from(rateQuotes)
    .innerJoin(providers, eq(rateQuotes.providerId, providers.id))
    .where(eq(providers.active, true))
    .orderBy(sql`${providers.slug}`)
}

/**
 * Every unordered pair, emitted in one canonical order only.
 *
 * Generating both wise-vs-remitly and remitly-vs-wise would create duplicate
 * pages competing for the same query, so the alphabetically-first slug always
 * leads and the reverse form 404s.
 */
export async function generateStaticParams() {
  try {
    const rows = await quotableProviders()
    const pairs: { pair: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        pairs.push({ pair: `${rows[i].slug}-vs-${rows[j].slug}` })
      }
    }
    return pairs
  } catch {
    // No database at build time — pages still render on demand.
    return []
  }
}

function parsePair(pair: string): [string, string] | null {
  const parts = pair.split('-vs-')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  // Enforce the canonical order so only one URL per pair resolves.
  if (parts[0] >= parts[1]) return null
  return [parts[0], parts[1]]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pair: string }>
}): Promise<Metadata> {
  const { locale: localeParam, pair } = await params
  if (!isLocale(localeParam)) notFound()
  const parsed = parsePair(pair)
  if (!parsed) return {}

  const rows = await db
    .select({ slug: providers.slug, name: providers.name })
    .from(providers)
    .where(sql`${providers.slug} in (${parsed[0]}, ${parsed[1]})`)
    .catch(() => [])

  const a = rows.find((r) => r.slug === parsed[0])
  const b = rows.find((r) => r.slug === parsed[1])
  if (!a || !b) return {}

  return publicPageMetadata({
    title: `${a.name} vs ${b.name}: transfer rates to Pakistan | PakRemits`,
    description: `Compare ${a.name} and ${b.name} for sending money to Pakistan. Check available exchange rates, fees, delivery options and rupees received.`,
    path: `/compare/${pair}`,
  })
}

export default async function ComparePairPage({
  params,
}: {
  params: Promise<{ locale: string; pair: string }>
}) {
  const { locale: localeParam, pair } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)
  const parsed = parsePair(pair)
  if (!parsed) notFound()

  const rows = await db
    .select()
    .from(providers)
    // Unguarded on purpose: this page is only about these two providers, so an
    // outage has nothing to degrade to and a 404 would tell crawlers the page
    // is gone. A 5xx means "try again". Same reasoning as /providers/[slug].
    .where(sql`${providers.slug} in (${parsed[0]}, ${parsed[1]})`)

  const a = rows.find((r) => r.slug === parsed[0])
  const b = rows.find((r) => r.slug === parsed[1])
  if (!a || !b || a.isBenchmark || b.isBenchmark) notFound()

  // Head to head in every corridor, at that corridor's default amount.
  const perCorridor = await Promise.all(
    CORRIDORS.map(async (corridor) => {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        method: 'bank',
        includeBenchmark: false,
      })
      return {
        corridor,
        amount: comparison?.amount ?? null,
        aRow: comparison?.rows.find((r) => r.quote.providerSlug === a.slug) ?? null,
        bRow: comparison?.rows.find((r) => r.quote.providerSlug === b.slug) ?? null,
      }
    }),
  )

  const contested = perCorridor.filter((entry) => entry.aRow && entry.bRow)
  const aWins = contested.filter(
    (entry) => entry.aRow!.quote.amountReceived > entry.bRow!.quote.amountReceived,
  ).length
  const bWins = contested.length - aWins

  const verdict =
    contested.length === 0
      ? `We cannot currently compare ${a.name} and ${b.name} directly — there is no corridor where we hold a live quote for both.`
      : aWins === bWins
        ? `Honours are even right now: ${a.name} pays more in ${aWins} of the ${contested.length} corridors where both are available, and ${b.name} in the other ${bWins}.`
        : aWins > bWins
          ? `${a.name} currently pays more rupees in ${aWins} of the ${contested.length} corridors where both are available.`
          : `${b.name} currently pays more rupees in ${bWins} of the ${contested.length} corridors where both are available.`

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
            <li className="text-ink">
              {a.name} vs {b.name}
            </li>
          </ol>
        </nav>

        <h1 className="mt-5 text-[clamp(32px,4.4vw,48px)] leading-[1.05] font-semibold">
          {a.name} vs {b.name} for sending to Pakistan
        </h1>

        <p className="mt-5 max-w-[62ch] text-[18px] text-muted">{verdict}</p>

        <p className="mt-3 max-w-[62ch] text-[15px] text-faint">
          Recomputed from live quotes every 15 minutes. A promotional rate can flip this in either
          direction from one week to the next, which is why this page states a count rather than
          crowning a permanent winner.
        </p>

        <section className="mt-10">
          <h2 className="text-[26px] leading-tight font-semibold">Corridor by corridor</h2>

          <div className="mt-4 overflow-x-auto rounded-panel border border-line bg-surface">
            <table className="w-full min-w-[760px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th className="p-4 font-medium">Corridor</th>
                  <th className="p-4 text-right font-medium">{a.name}</th>
                  <th className="p-4 text-right font-medium">{b.name}</th>
                  <th className="p-4 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {perCorridor.map((entry) => {
                  const symbol = CURRENCY_SYMBOLS[entry.corridor.fromCurrency]
                  const aAmount = entry.aRow?.quote.amountReceived ?? null
                  const bAmount = entry.bRow?.quote.amountReceived ?? null
                  const both = aAmount !== null && bAmount !== null
                  const aBetter = both && aAmount > bAmount

                  return (
                    <tr key={entry.corridor.slug} className="border-b border-line-2 last:border-0">
                      <td className="p-4">
                        <Link
                          href={corridorPath(entry.corridor.slug)}
                          className="text-ink no-underline hover:text-leaf"
                        >
                          {entry.corridor.fromCountryName}
                        </Link>
                        {entry.amount !== null && (
                          <small className="block text-xs text-faint">
                            on {formatSend(symbol, entry.amount)}
                          </small>
                        )}
                      </td>

                      <td
                        className={`p-4 text-right tabular-nums ${
                          both && aBetter ? 'font-semibold text-leaf' : ''
                        }`}
                      >
                        {aAmount !== null ? formatPkr(aAmount) : '—'}
                      </td>
                      <td
                        className={`p-4 text-right tabular-nums ${
                          both && !aBetter ? 'font-semibold text-leaf' : ''
                        }`}
                      >
                        {bAmount !== null ? formatPkr(bAmount) : '—'}
                      </td>
                      <td className="p-4 text-right text-[13.5px] tabular-nums text-muted">
                        {both ? formatPkr(Math.abs(aAmount - bAmount)) : 'Not comparable'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-12 grid max-w-[68ch] gap-8">
          <section>
            <h2 className="text-[26px] leading-tight font-semibold">How they differ</h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              <p>
                The two price transfers in structurally different ways, which is why one can look
                cheaper while the other delivers more. Check the fee and rate columns on a corridor
                page rather than trusting either provider’s headline.
              </p>
              <p>
                A provider charging no fee is not necessarily better value — the margin may simply
                sit in the exchange rate instead. Equally, a visible fee alongside the true
                mid-market rate is often the cheaper deal on a large transfer. Our tables settle it
                by computing what actually arrives, which is the only comparison that holds across
                both models.
              </p>
              <p>
                Promotional first-transfer rates complicate this further: they are real, they are
                worth taking, and they apply once. If you send monthly, the ordinary rate matters
                far more than the introductory one.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] leading-tight font-semibold">Read more</h2>
            <ul className="mt-3 grid gap-2 text-[16px]">
              <li>
                <Link
                  href={`/providers/${a.slug}`}
                  className="text-leaf underline underline-offset-2"
                >
                  {a.name} rates across every corridor
                </Link>
              </li>
              <li>
                <Link
                  href={`/providers/${b.slug}`}
                  className="text-leaf underline underline-offset-2"
                >
                  {b.name} rates across every corridor
                </Link>
              </li>
              <li>
                <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
                  How we decide which is better
                </Link>
              </li>
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
                name: `${a.name} vs ${b.name}`,
                item: `${SITE}/compare/${pair}`,
              },
            ],
          }),
        }}
      />
    </>
  )
}
