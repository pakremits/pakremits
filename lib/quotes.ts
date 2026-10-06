/**
 * The read side: turning stored quotes into a ranked comparison table.
 *
 * Every page the static build renders reads through here. The ranking itself
 * is in lib/comparison.ts, which the browser runs too, so a table re-ranked in
 * the browser can never disagree with the one baked into the page.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { IN_STATIC_BUILD } from '@/lib/build-phase'
import { db, toNum } from '@/lib/db'
import {
  type DeliveryMethod,
  type SendCurrency,
  bankBenchmarks,
  corridors,
  latestQuotes,
  midMarketRates,
  providers,
} from '@/lib/db/schema'
import { CURRENCY_SYMBOLS, corridorBySlug as corridorConfigBySlug, defaultAmountFor } from '@/lib/corridors'
import {
  type Comparison,
  type QuoteSnapshot,
  comparisonFromSnapshot,
  nearestStandardAmount,
  quotedMethod,
} from '@/lib/comparison'
import { round } from '@/lib/ranking/compute'
import type { SortKey } from '@/lib/ranking/rank'

export type { Comparison, ComparisonRow, QuoteSnapshot } from '@/lib/comparison'
export { nearestStandardAmount } from '@/lib/comparison'

/**
 * The bank benchmark lives in the `bank_benchmarks` table, not in code. It
 * moved because the savings ledger measures against it, and a figure that a
 * user-facing total depends on needs a row, a date and a provenance note
 * rather than a constant nobody can audit.
 *
 * The markup assumptions that generate it, and the weekly refresh, are in
 * lib/proof/benchmarks.ts. /how-we-rank#savings renders the live table.
 */

/**
 * Run a read against the database, degrading instead of throwing.
 *
 * Without this a database blip takes a whole page down with a stack trace. The
 * rest of this codebase degrades (a failed adapter becomes a stale badge, a
 * failed send becomes a warning) and the read path should too. Failures are
 * logged loudly rather than swallowed, and callers distinguish "no rows" from
 * "could not reach the database" so the UI never states something false about
 * the market.
 *
 * Except in the static build: there a page that degraded would be published
 * and served as-is until the next deploy, so a failed read fails the build
 * and the site keeps serving the last good one.
 */
async function safeRead<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (IN_STATIC_BUILD) throw error
    console.error(`[quotes] ${label} failed:`, error)
    return fallback
  }
}

async function readLatestMidMarket(currency: SendCurrency): Promise<number | null> {
  const [row] = await db
    .select({ rate: midMarketRates.rate })
    .from(midMarketRates)
    .where(eq(midMarketRates.fromCurrency, currency))
    .orderBy(desc(midMarketRates.capturedAt))
    .limit(1)

  return row ? toNum(row.rate) : null
}

/** Most recent mid-market rate for a currency. */
export async function latestMidMarket(currency: SendCurrency): Promise<number | null> {
  return safeRead(`latestMidMarket(${currency})`, null, () => readLatestMidMarket(currency))
}

/**
 * One corridor's quote snapshot, or null when there is no such active
 * corridor. Throws if the database cannot be read.
 *
 * With `only`, just that method and amount band is read: what one table needs.
 * Without it, every method and band, which is what /data/quotes/{corridor}.json
 * serves so the browser can re-rank at any amount and payout.
 */
export async function loadQuoteSnapshot(
  corridorSlug: string,
  only?: { method: DeliveryMethod; amount: number },
): Promise<QuoteSnapshot | null> {
  const [corridor] = await db
    .select()
    .from(corridors)
    .where(and(eq(corridors.slug, corridorSlug), eq(corridors.active, true)))
    .limit(1)
  if (!corridor) return null

  const slot = only
    ? and(
        eq(latestQuotes.deliveryMethod, only.method),
        eq(latestQuotes.amountSent, nearestStandardAmount(corridor.fromCurrency, only.amount)),
      )
    : undefined

  const [quotes, benchmarks, midMarketRate] = await Promise.all([
    db
      .select({
        providerSlug: providers.slug,
        providerName: providers.name,
        brandColor: providers.brandColor,
        brandTextColor: providers.brandTextColor,
        featured: providers.featured,
        affiliateUrlTemplate: providers.affiliateUrlTemplate,
        deliveryMethod: latestQuotes.deliveryMethod,
        amountSent: latestQuotes.amountSent,
        rate: latestQuotes.rate,
        fee: latestQuotes.fee,
        deliverySpeedText: latestQuotes.deliverySpeedText,
        deliverySpeedMinutes: latestQuotes.deliverySpeedMinutes,
        promo: latestQuotes.promoFlag,
        promoNote: latestQuotes.promoNote,
        source: latestQuotes.source,
        stale: latestQuotes.stale,
        capturedAt: latestQuotes.capturedAt,
      })
      .from(latestQuotes)
      .innerJoin(providers, eq(latestQuotes.providerId, providers.id))
      .where(
        and(
          eq(latestQuotes.corridorId, corridor.id),
          eq(providers.active, true),
          // The benchmark is priced from bank_benchmarks, never from a quote row.
          eq(providers.isBenchmark, false),
          slot,
        ),
      )
      // A fixed order, so ranking ties break the same way on every read.
      .orderBy(latestQuotes.providerId),
    db
      .select()
      .from(bankBenchmarks)
      .where(
        and(
          eq(bankBenchmarks.corridorId, corridor.id),
          only ? eq(bankBenchmarks.deliveryMethod, only.method) : undefined,
        ),
      ),
    readLatestMidMarket(corridor.fromCurrency),
  ])

  return {
    corridorSlug: corridor.slug,
    corridorId: corridor.id,
    fromCurrency: corridor.fromCurrency,
    midMarketRate,
    benchmarks: Object.fromEntries(
      benchmarks.map((row) => [
        row.deliveryMethod,
        { rate: toNum(row.rate), fee: toNum(row.fee), updatedAt: row.updatedAt.getTime() },
      ]),
    ),
    quotes: quotes.map(({ affiliateUrlTemplate, capturedAt, rate, fee, ...quote }) => ({
      ...quote,
      rate: toNum(rate),
      fee: toNum(fee),
      hasAffiliateLink: Boolean(affiliateUrlTemplate),
      capturedAt: capturedAt.getTime(),
    })),
  }
}

/**
 * The comparison table for one corridor, method, and amount.
 *
 * Reads `latest_quotes`, which holds exactly the newest quote per provider for
 * each slot, so this is a primary-key range read of a dozen rows rather than a
 * search through weeks of history.
 */
export async function getComparison(options: {
  corridorSlug: string
  method?: DeliveryMethod
  amount?: number
  sortBy?: SortKey
  includeBenchmark?: boolean
}): Promise<Comparison | null> {
  const { corridorSlug } = options
  const method = quotedMethod(options.method ?? 'bank')

  const snapshot = await safeRead(`getComparison(${corridorSlug})`, undefined, () =>
    loadQuoteSnapshot(corridorSlug, {
      method,
      amount:
        options.amount ?? defaultAmountFor(corridorConfigBySlug(corridorSlug)?.fromCurrency ?? 'GBP'),
    }),
  )

  if (snapshot === undefined) {
    // The database could not be read: say so rather than show an empty market.
    const currency = corridorConfigBySlug(corridorSlug)?.fromCurrency ?? 'GBP'
    const amount = options.amount ?? defaultAmountFor(currency)
    return {
      unavailable: true,
      corridorSlug,
      corridorId: null,
      fromCurrency: currency,
      currencySymbol: CURRENCY_SYMBOLS[currency],
      deliveryMethod: method,
      amount,
      quotedAtAmount: amount,
      midMarketRate: null,
      rows: [],
      savingVsBank: null,
      capturedAt: null,
      stale: false,
    }
  }
  if (snapshot === null) return null

  return comparisonFromSnapshot(snapshot, { ...options, method })
}

export interface RateSeries {
  currency: SendCurrency
  points: { date: Date; rate: number }[]
  latest: number | null
  /** Percent change from the first point to the latest. */
  changePercent: number | null
}

/**
 * Daily mid-market series for the hero ticker and the corridor-page charts:
 * the last reading of each UTC day.
 *
 * Counted back from this currency's newest reading, not from now: if the
 * refresh stalls, a "7-day" series must still cover the 7 days before the
 * "refreshed at" time the page shows, not shrink to the one or two readings
 * left inside a window that runs to today.
 */
export async function getMidMarketSeries(
  currency: SendCurrency,
  days = 7,
): Promise<RateSeries> {
  // SQLite fills a bare column in a max() query from the row holding the
  // maximum, so `rate` here is the day's last reading.
  const rows = await safeRead(`getMidMarketSeries(${currency})`, [], () =>
    db.all<{ day: string; at: number; rate: number }>(sql`
      SELECT
        date(${midMarketRates.capturedAt} / 1000, 'unixepoch') AS day,
        max(${midMarketRates.capturedAt}) AS at,
        ${midMarketRates.rate} AS rate
      FROM ${midMarketRates}
      WHERE ${midMarketRates.fromCurrency} = ${currency}
        AND ${midMarketRates.capturedAt} > (
          SELECT max(latest.captured_at) FROM ${midMarketRates} AS latest
          WHERE latest.from_currency = ${currency}
        ) - ${days * 86_400_000}
      GROUP BY day
      ORDER BY day
    `),
  )

  const points = rows
    .map((row) => ({ date: new Date(`${row.day}T00:00:00Z`), rate: toNum(row.rate) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const first = points.at(0)?.rate ?? null
  const latest = points.at(-1)?.rate ?? null

  return {
    currency,
    points,
    latest,
    changePercent:
      first !== null && latest !== null && first > 0
        ? round(((latest - first) / first) * 100, 2)
        : null,
  }
}

/** A chart point as plain numbers, so it can cross into a client component. */
export interface RatePoint {
  /** Epoch milliseconds. */
  t: number
  rate: number
}

export interface RateHistory {
  /** One point per day, oldest first, up to `days` back. */
  daily: RatePoint[]
  /** Every capture in the last 24 hours, oldest first; empty if there are none. */
  intraday: RatePoint[]
}

/**
 * Everything the interactive rate chart needs: daily points for the week,
 * month and full views, and the raw 15-minute captures for the 24-hour view.
 */
export async function getMidMarketHistory(currency: SendCurrency, days = 90): Promise<RateHistory> {
  const [series, rows] = await Promise.all([
    getMidMarketSeries(currency, days),
    safeRead(`getMidMarketHistory(${currency})`, [], () =>
      db.all<{ at: number; rate: number }>(sql`
        SELECT ${midMarketRates.capturedAt} AS at, ${midMarketRates.rate} AS rate
        FROM ${midMarketRates}
        WHERE ${midMarketRates.fromCurrency} = ${currency}
          -- The 24 hours before the newest reading (see getMidMarketSeries).
          AND ${midMarketRates.capturedAt} > (
            SELECT max(latest.captured_at) FROM ${midMarketRates} AS latest
            WHERE latest.from_currency = ${currency}
          ) - ${86_400_000}
        ORDER BY ${midMarketRates.capturedAt}
      `),
    ),
  ])

  return {
    daily: series.points.map((point) => ({ t: point.date.getTime(), rate: point.rate })),
    intraday: rows.map((row) => ({ t: new Date(row.at).getTime(), rate: toNum(row.rate) })),
  }
}

/** Best available rate per corridor, for the home page's corridor chips. */
export async function getBestRatePerCorridor(): Promise<
  {
    slug: string
    countryCode: string
    countryName: string
    currency: SendCurrency
    bestRate: number | null
  }[]
> {
  const corridorRows = await safeRead('getBestRatePerCorridor', [], () =>
    db.select().from(corridors).where(eq(corridors.active, true)),
  )

  return Promise.all(
    corridorRows.map(async (corridor) => {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        includeBenchmark: false,
      })
      const best = comparison?.rows.find((r) => r.isBest)

      return {
        slug: corridor.slug,
        countryCode: corridor.fromCountry,
        countryName: corridor.fromCountryName,
        currency: corridor.fromCurrency,
        bestRate: best ? best.quote.rate : null,
      }
    }),
  )
}
