/**
 * A comparison table, computed from one corridor's quote snapshot.
 *
 * Pure, and free of anything server-only, so the static build and the browser
 * run the same code: the build renders each page's table from the database,
 * and the browser recomputes it from /data/quotes/{corridor}.json when a
 * reader changes the amount, payout or sort. One implementation of the
 * ranking rules, not two that can drift.
 *
 * Note there is no `providers.featured` ordering here — sponsorship is applied
 * by `rankQuotes`, below the winner, never above.
 */
import { isOutOfDate } from '@/lib/cadence'
import { CURRENCY_SYMBOLS, STANDARD_AMOUNTS, defaultAmountFor } from '@/lib/corridors'
import type { DeliveryMethod, SendCurrency } from '@/lib/db/schema'
import { computeReceived } from '@/lib/ranking/compute'
import { type RankedQuote, type SortKey, rankQuotes, savingVsBenchmark } from '@/lib/ranking/rank'

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
  /** True when a row is a stale re-serve or the oldest capture is out of date. */
  stale: boolean
}

/** One provider's quote in a snapshot. Times are epoch milliseconds: it is plain JSON. */
export interface SnapshotQuote {
  providerSlug: string
  providerName: string
  brandColor: string
  brandTextColor: string
  featured: boolean
  hasAffiliateLink: boolean
  deliveryMethod: DeliveryMethod
  amountSent: number
  rate: number
  fee: number
  deliverySpeedText: string
  deliverySpeedMinutes: number | null
  promo: boolean
  promoNote: string | null
  source: string
  stale: boolean
  capturedAt: number
}

export interface SnapshotBenchmark {
  rate: number
  fee: number
  updatedAt: number
}

/**
 * Everything needed to rank one corridor at any amount, payout and sort: the
 * latest quote per provider, method and grid amount, the bank benchmark per
 * method, and the mid-market rate. Served as /data/quotes/{corridor}.json.
 */
export interface QuoteSnapshot {
  corridorSlug: string
  corridorId: number
  fromCurrency: SendCurrency
  midMarketRate: number | null
  benchmarks: Partial<Record<DeliveryMethod, SnapshotBenchmark>>
  /** Ordered by provider id, so ranking ties break the same way everywhere. */
  quotes: SnapshotQuote[]
}

/** /data/quotes/{corridor}.json: a full snapshot plus what the results page charts. */
export interface CorridorDataFile extends QuoteSnapshot {
  /** When the site was built from these quotes. */
  generatedAt: number
  /** The last week of daily mid-market rates, oldest first. */
  week: { t: number; rate: number }[]
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
 * The rail a method is quoted on. Named account destinations (SadaPay and
 * NayaPay accounts, the Roshan Digital Account) are not separately quoted
 * payout rails, so they use the bank-deposit quotes and benchmark.
 */
export function quotedMethod(method: DeliveryMethod): DeliveryMethod {
  return method === 'neobank' || method === 'rda' ? 'bank' : method
}

/** The bank benchmark as a comparison row, priced at the amount asked for. */
function benchmarkRow(
  benchmark: SnapshotBenchmark,
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
    capturedAt: new Date(benchmark.updatedAt),
    featured: false,
    isBenchmark: true,
    hasAffiliateLink: false,
  }
}

export interface ComparisonOptions {
  method?: DeliveryMethod
  amount?: number
  sortBy?: SortKey
  includeBenchmark?: boolean
  /** The clock staleness is judged by: the build's, then the reader's. */
  now?: number
}

/** The ranked comparison table for one method and amount. */
export function comparisonFromSnapshot(
  snapshot: QuoteSnapshot,
  options: ComparisonOptions = {},
): Comparison {
  const { sortBy = 'received', includeBenchmark = true, now = Date.now() } = options
  const method = quotedMethod(options.method ?? 'bank')
  const currency = snapshot.fromCurrency
  const amount = options.amount ?? defaultAmountFor(currency)
  const quotedAtAmount = nearestStandardAmount(currency, amount)

  const rows: ComparisonRow[] = snapshot.quotes
    .filter((quote) => quote.deliveryMethod === method && quote.amountSent === quotedAtAmount)
    .map((quote) => ({
      providerSlug: quote.providerSlug,
      providerName: quote.providerName,
      brandColor: quote.brandColor,
      brandTextColor: quote.brandTextColor,
      rate: quote.rate,
      fee: quote.fee,
      // Recomputed for the requested amount rather than reusing the stored
      // figure, which was calculated at `quotedAtAmount`.
      amountReceived: computeReceived(amount, quote.rate, quote.fee),
      deliverySpeedText: quote.deliverySpeedText,
      deliverySpeedMinutes: quote.deliverySpeedMinutes,
      promo: quote.promo,
      promoNote: quote.promoNote,
      deliveryMethod: method,
      source: quote.source,
      stale: quote.stale,
      capturedAt: new Date(quote.capturedAt),
      featured: quote.featured,
      isBenchmark: false,
      hasAffiliateLink: quote.hasAffiliateLink,
    }))

  const benchmark = snapshot.benchmarks[method]
  if (includeBenchmark && benchmark && rows.length > 0) {
    rows.push(benchmarkRow(benchmark, amount, method))
  }

  const ranked = rankQuotes(rows, sortBy)

  const captureTimes = rows.filter((row) => !row.isBenchmark).map((row) => row.capturedAt.getTime())
  const oldest = captureTimes.length ? new Date(Math.min(...captureTimes)) : null

  return {
    corridorSlug: snapshot.corridorSlug,
    corridorId: snapshot.corridorId,
    fromCurrency: currency,
    currencySymbol: CURRENCY_SYMBOLS[currency],
    deliveryMethod: method,
    amount,
    quotedAtAmount,
    midMarketRate: snapshot.midMarketRate,
    rows: ranked,
    savingVsBank: savingVsBenchmark(ranked),
    capturedAt: oldest,
    stale: rows.some((row) => row.stale) || (oldest !== null && isOutOfDate(oldest, now)),
  }
}
