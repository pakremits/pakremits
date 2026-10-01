/**
 * The read side: turning stored quotes into a ranked comparison table.
 *
 * Everything the public site renders comes through here, so the ranking promise
 * is enforced in one place. Note there is no `providers.featured` ordering in
 * the SQL — sponsorship is applied by `rankQuotes`, below the winner, never above.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import {
  type DeliveryMethod,
  type SendCurrency,
  corridors,
  midMarketRates,
  providers,
  rateQuotes,
} from '@/lib/db/schema'
import {
  CURRENCY_SYMBOLS,
  STANDARD_AMOUNTS,
  corridorBySlug as corridorConfigBySlug,
  defaultAmountFor,
} from '@/lib/corridors'
import { computeReceived, round } from '@/lib/ranking/compute'
import { type Benchmark, getBenchmark } from '@/lib/proof/benchmarks'
import { type RankedQuote, type SortKey, rankQuotes, savingVsBenchmark } from '@/lib/ranking/rank'

/**
 * The bank benchmark now lives in the `bank_benchmarks` table, not in this
 * file. It moved because the savings ledger measures against it, and a figure
 * that a user-facing total depends on needs a row, a date and a provenance
 * note rather than a constant nobody can audit.
 *
 * The markup assumptions that generate it, and the weekly refresh, are in
 * lib/proof/benchmarks.ts. /how-we-rank#savings renders the live table.
 */

/** A quote as the UI needs it: provider branding included, numbers pre-computed. */
export interface ComparisonRow {
  providerSlug: string
  providerName: string
  brandColor: string
  brandTextColor: string
  rate: number
  fee: number
  amountReceived: number
  deliverySpeedText: string
  deliverySpeedMinutes: number | null
  promo: boolean
  promoNote: string | null
  deliveryMethod: DeliveryMethod
  source: string
  stale: boolean
  capturedAt: Date
  featured: boolean
  isBenchmark: boolean
  /** Null for the benchmark row, which never links out. */
  hasAffiliateLink: boolean
}

export interface Comparison {
  /**
   * True when we could not reach the database at all.
   *
   * Distinct from "no rows": an outage must not render as "no provider
   * delivers to Pakistan this way", which is a false statement about the
   * market rather than an honest admission that we are broken.
   */
  unavailable?: boolean
  corridorSlug: string
  /** Needed by the proof layer to attribute a comparison event to a corridor. */
  corridorId: number | null
  fromCurrency: SendCurrency
  currencySymbol: string
  deliveryMethod: DeliveryMethod
  /** The amount the user asked for. */
  amount: number
  /** The stored grid amount the rates were captured at. See `quotedAtAmount`. */
  quotedAtAmount: number
  midMarketRate: number | null
  rows: RankedQuote<ComparisonRow>[]
  /** PKR the best provider beats the bank by. Null when no benchmark exists. */
  savingVsBank: number | null
  /** Oldest capture time across the rows — drives the "captured 14:28 PKT" line. */
  capturedAt: Date | null
  /** True when any row is older than 60 minutes. */
  stale: boolean
}

/**
 * Pick the grid amount closest to what the user typed.
 *
 * We refresh at 100/500/1000/2000 rather than on demand, so an arbitrary amount
 * reuses the nearest band's rate and fee and recomputes the received figure for
 * the real amount. Rate and fee are near-flat inside a band; the exception is a
 * promotional rate with a cap, which the adapters already resolve at capture
 * time. The UI shows which band was used so the number is never unexplained.
 */
export function nearestStandardAmount(currency: SendCurrency, amount: number): number {
  const grid = STANDARD_AMOUNTS[currency] ?? [100, 500, 1000, 2000]
  return grid.reduce((best, candidate) =>
    Math.abs(candidate - amount) < Math.abs(best - amount) ? candidate : best,
  )
}

/**
 * Run a read against the database, degrading instead of throwing.
 *
 * Every public page reads through this module. Without it a database blip
 * takes the whole site down with a stack trace — which is exactly what a
 * torn-down local Postgres produced: `ECONNREFUSED` surfaced as a 500 on the
 * home page. The rest of this codebase degrades (a failed adapter becomes a
 * stale badge, a failed send becomes a warning) and the read path should too.
 *
 * Failures are logged loudly rather than swallowed, and callers distinguish
 * "no rows" from "could not reach the database" so the UI never states
 * something false about the market.
 */
async function safeRead<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    console.error(`[quotes] ${label} failed:`, error)
    return fallback
  }
}

/** Most recent mid-market rate for a currency. */
export async function latestMidMarket(currency: SendCurrency): Promise<number | null> {
  return safeRead(`latestMidMarket(${currency})`, null, async () => {
    const [row] = await db
      .select({ rate: midMarketRates.rate })
      .from(midMarketRates)
      .where(eq(midMarketRates.fromCurrency, currency))
      .orderBy(desc(midMarketRates.capturedAt))
      .limit(1)

    return row ? toNum(row.rate) : null
  })
}

/**
 * Build the bank benchmark row from the stored benchmark for this corridor.
 *
 * Returns null when the corridor has no benchmark recorded. That is a real
 * state, not an error: the table simply shows no comparison row, and
 * `savingVsBank` stays null rather than being measured against a guess.
 */
function benchmarkRow(
  benchmark: Benchmark,
  amount: number,
  method: DeliveryMethod,
): ComparisonRow {
  return {
    providerSlug: 'typical-bank',
    providerName: 'Bank Transfer',
    brandColor: '#8A8F8C',
    brandTextColor: '#FFFFFF',
    rate: benchmark.rate,
    fee: benchmark.fee,
    amountReceived: computeReceived(amount, benchmark.rate, benchmark.fee),
    deliverySpeedText: '2–4 days',
    deliverySpeedMinutes: 4320,
    promo: false,
    promoNote: null,
    deliveryMethod: method,
    source: 'benchmark',
    stale: false,
    capturedAt: benchmark.updatedAt,
    featured: false,
    isBenchmark: true,
    hasAffiliateLink: false,
  }
}

const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * The comparison table for one corridor, method, and amount.
 *
 * Uses Postgres `DISTINCT ON` to take only the newest quote per provider, which
 * is far cheaper than a window function over a table that grows by ~4,000 rows a
 * day.
 */
export async function getComparison(options: {
  corridorSlug: string
  method?: DeliveryMethod
  amount?: number
  sortBy?: SortKey
  includeBenchmark?: boolean
}): Promise<Comparison | null> {
  const { corridorSlug, method: selectedMethod = 'bank', sortBy = 'received', includeBenchmark = true } = options
  // These are named account destinations, not separately quoted payout rails.
  // Use the bank-deposit quote and benchmark rather than empty legacy slots.
  const method = selectedMethod === 'neobank' || selectedMethod === 'rda' ? 'bank' : selectedMethod

  const config = corridorConfigBySlug(corridorSlug)

  /** Shape returned when the database is unreachable. */
  const outage = (): Comparison => ({
    unavailable: true,
    corridorSlug,
    corridorId: null,
    fromCurrency: config?.fromCurrency ?? 'GBP',
    currencySymbol: CURRENCY_SYMBOLS[config?.fromCurrency ?? 'GBP'],
    deliveryMethod: method,
    amount: options.amount ?? defaultAmountFor(config?.fromCurrency ?? 'GBP'),
    quotedAtAmount: options.amount ?? defaultAmountFor(config?.fromCurrency ?? 'GBP'),
    midMarketRate: null,
    rows: [],
    savingVsBank: null,
    capturedAt: null,
    stale: false,
  })

  const corridorRows = await safeRead(`getComparison(${corridorSlug}) corridor`, null, () =>
    db
      .select()
      .from(corridors)
      .where(and(eq(corridors.slug, corridorSlug), eq(corridors.active, true)))
      .limit(1),
  )

  // null means the query threw; an empty array means no such corridor.
  if (corridorRows === null) return outage()
  const [corridor] = corridorRows
  if (!corridor) return null

  const currency = corridor.fromCurrency
  const amount = options.amount ?? (currency === 'GBP' ? 500 : STANDARD_AMOUNTS[currency][1])
  const quotedAtAmount = nearestStandardAmount(currency, amount)

  /**
   * `DISTINCT ON (provider_id)` takes only the newest quote per provider inside
   * Postgres. The alternative — fetching every quote for the slot and reducing
   * in JS — would pull weeks of history to keep a handful of rows, since this
   * table grows by thousands of rows a day.
   */
  const rows = (await safeRead(`getComparison(${corridorSlug}) quotes`, null, () =>
    db.execute(sql`
    SELECT DISTINCT ON (${rateQuotes.providerId})
      ${providers.slug}                 AS provider_slug,
      ${providers.name}                 AS provider_name,
      ${providers.brandColor}           AS brand_color,
      ${providers.brandTextColor}       AS brand_text_color,
      ${providers.featured}             AS featured,
      ${providers.isBenchmark}          AS is_benchmark,
      ${providers.affiliateUrlTemplate} AS affiliate_url_template,
      ${rateQuotes.rate}                AS rate,
      ${rateQuotes.fee}                 AS fee,
      ${rateQuotes.deliverySpeedText}   AS delivery_speed_text,
      ${rateQuotes.deliverySpeedMinutes} AS delivery_speed_minutes,
      ${rateQuotes.promoFlag}           AS promo_flag,
      ${rateQuotes.promoNote}           AS promo_note,
      ${rateQuotes.source}              AS source,
      ${rateQuotes.stale}               AS stale,
      ${rateQuotes.capturedAt}          AS captured_at
    FROM ${rateQuotes}
    INNER JOIN ${providers} ON ${rateQuotes.providerId} = ${providers.id}
    WHERE ${rateQuotes.corridorId} = ${corridor.id}
      AND ${rateQuotes.deliveryMethod} = ${method}
      AND ${rateQuotes.amountSent} = ${String(quotedAtAmount)}
      AND ${providers.active} = true
    ORDER BY ${rateQuotes.providerId}, ${rateQuotes.capturedAt} DESC
  `),
  )) as unknown as null | {
    provider_slug: string
    provider_name: string
    brand_color: string
    brand_text_color: string
    featured: boolean
    is_benchmark: boolean
    affiliate_url_template: string | null
    rate: string
    fee: string
    delivery_speed_text: string
    delivery_speed_minutes: number | null
    promo_flag: boolean
    promo_note: string | null
    source: string
    stale: boolean
    captured_at: Date
  }[]

  if (rows === null) return outage()

  // Fetched together: both are needed before the rows can be ranked, and the
  // benchmark is a single indexed lookup.
  const [midMarket, benchmark] = await Promise.all([
    latestMidMarket(currency),
    safeRead(`getBenchmark(${corridor.id}/${method})`, null, () =>
      getBenchmark(corridor.id, method),
    ),
  ])

  const comparisonRows: ComparisonRow[] = rows
    // The stored benchmark provider is replaced by a live-computed row below.
    .filter((row) => !row.is_benchmark)
    .map((row) => {
      const rate = toNum(row.rate)
      const fee = toNum(row.fee)
      return {
        providerSlug: row.provider_slug,
        providerName: row.provider_name,
        brandColor: row.brand_color,
        brandTextColor: row.brand_text_color,
        rate,
        fee,
        // Recomputed for the requested amount rather than reusing the stored
        // figure, which was calculated at `quotedAtAmount`.
        amountReceived: computeReceived(amount, rate, fee),
        deliverySpeedText: row.delivery_speed_text,
        deliverySpeedMinutes: row.delivery_speed_minutes,
        promo: row.promo_flag,
        promoNote: row.promo_note,
        deliveryMethod: method,
        source: row.source,
        stale: row.stale,
        capturedAt: new Date(row.captured_at),
        featured: row.featured,
        isBenchmark: false,
        hasAffiliateLink: Boolean(row.affiliate_url_template),
      }
    })

  if (includeBenchmark && benchmark !== null && comparisonRows.length > 0) {
    comparisonRows.push(benchmarkRow(benchmark, amount, method))
  }

  const ranked = rankQuotes(comparisonRows, sortBy)

  const captureTimes = comparisonRows.filter((r) => !r.isBenchmark).map((r) => r.capturedAt)
  const oldest = captureTimes.length
    ? new Date(Math.min(...captureTimes.map((d) => d.getTime())))
    : null

  return {
    corridorSlug: corridor.slug,
    corridorId: corridor.id,
    fromCurrency: currency,
    currencySymbol: CURRENCY_SYMBOLS[currency],
    deliveryMethod: method,
    amount,
    quotedAtAmount,
    midMarketRate: midMarket,
    rows: ranked,
    savingVsBank: savingVsBenchmark(ranked),
    capturedAt: oldest,
    stale:
      comparisonRows.some((r) => r.stale) ||
      (oldest !== null && Date.now() - oldest.getTime() > STALE_AFTER_MS),
  }
}

export interface RateSeries {
  currency: SendCurrency
  points: { date: Date; rate: number }[]
  latest: number | null
  /** Percent change from the first point to the latest. */
  changePercent: number | null
}

/**
 * Daily mid-market series for the hero ticker and the corridor-page charts.
 *
 * Collapses to one point per day — the cron writes a row every 15 minutes, and
 * a 30-day sparkline wants 30 points, not 2,880.
 */
export async function getMidMarketSeries(
  currency: SendCurrency,
  days = 7,
): Promise<RateSeries> {
  const rows = (await safeRead(`getMidMarketSeries(${currency})`, [], () =>
    db.execute(sql`
      SELECT DISTINCT ON (day)
        date_trunc('day', ${midMarketRates.capturedAt}) AS day,
        ${midMarketRates.rate} AS rate
      FROM ${midMarketRates}
      WHERE ${midMarketRates.fromCurrency} = ${currency}
        AND ${midMarketRates.capturedAt} > now() - make_interval(days => ${days})
      ORDER BY day, ${midMarketRates.capturedAt} DESC
    `),
  )) as unknown as { day: Date; rate: string }[]

  const points = rows
    .map((row) => ({ date: new Date(row.day), rate: toNum(row.rate) }))
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
      db.execute(sql`
        SELECT ${midMarketRates.capturedAt} AS at, ${midMarketRates.rate} AS rate
        FROM ${midMarketRates}
        WHERE ${midMarketRates.fromCurrency} = ${currency}
          AND ${midMarketRates.capturedAt} > now() - interval '24 hours'
        ORDER BY ${midMarketRates.capturedAt}
      `),
    ) as unknown as Promise<{ at: Date | string; rate: string }[]>,
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
