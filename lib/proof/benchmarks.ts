/**
 * The bank benchmark: read side, and the weekly refresh that maintains it.
 *
 * This used to be a hard-coded table of markups in lib/quotes.ts. It moved into
 * the database because the savings figure is only defensible if the number it
 * is measured against carries a date and a provenance note — both of which the
 * methodology page now shows. lib/quotes.ts reads through here so the
 * comparison table and the savings ledger can never disagree about what a
 * typical bank would have paid.
 */
import { and, count, eq, lt } from 'drizzle-orm'
import { db, runBatch, toMoney, toNum, toRate } from '@/lib/db'
import {
  type DeliveryMethod,
  type SendCurrency,
  bankBenchmarks,
  corridors,
} from '@/lib/db/schema'
import { computeReceived } from '@/lib/ranking/compute'

/**
 * Typical high-street retail pricing, as a markup off mid-market plus a wire
 * fee. These are the seed values the weekly refresh applies to the live
 * mid-market rate; an admin can overwrite any row with a real quote, which
 * pins it and takes it out of the refresh.
 *
 * They are assumptions, not observations, and the methodology page says so.
 */
export const BENCHMARK_ASSUMPTIONS: Record<
  SendCurrency,
  { markupPercent: number; fee: number }
> = {
  GBP: { markupPercent: 3.5, fee: 15 },
  EUR: { markupPercent: 3.2, fee: 15 },
  USD: { markupPercent: 3.8, fee: 25 },
  CAD: { markupPercent: 3.5, fee: 20 },
  AUD: { markupPercent: 3.5, fee: 20 },
  AED: { markupPercent: 2.8, fee: 40 },
  SAR: { markupPercent: 2.8, fee: 40 },
  QAR: { markupPercent: 2.8, fee: 40 },
}

/** How long a generated benchmark stands before the cron regenerates it. */
export const BENCHMARK_MAX_AGE_DAYS = 7

export interface Benchmark {
  corridorId: number
  deliveryMethod: DeliveryMethod
  rate: number
  fee: number
  note: string | null
  pinned: boolean
  updatedAt: Date
}

/**
 * The benchmark for one slot, or null when none has been recorded.
 *
 * Null is a real answer, not an error: a corridor with no benchmark produces a
 * ledger row with `savingPkr = null` that is excluded from every total. Never
 * substitute a default here — that would invent the number the whole proof
 * layer exists to avoid inventing.
 */
export async function getBenchmark(
  corridorId: number,
  deliveryMethod: DeliveryMethod,
): Promise<Benchmark | null> {
  try {
    const [row] = await db
      .select()
      .from(bankBenchmarks)
      .where(
        and(
          eq(bankBenchmarks.corridorId, corridorId),
          eq(bankBenchmarks.deliveryMethod, deliveryMethod),
        ),
      )
      .limit(1)

    if (!row) return null

    return {
      corridorId: row.corridorId,
      deliveryMethod: row.deliveryMethod,
      rate: toNum(row.rate),
      fee: toNum(row.fee),
      note: row.note,
      pinned: row.pinned,
      updatedAt: row.updatedAt,
    }
  } catch (error) {
    console.error('[proof] getBenchmark failed:', error)
    return null
  }
}

/** Every benchmark with its corridor, for the methodology table and /admin. */
export async function listBenchmarks(): Promise<
  (Benchmark & { corridorSlug: string; countryName: string; currency: SendCurrency })[]
> {
  try {
    const rows = await db
      .select({
        corridorId: bankBenchmarks.corridorId,
        deliveryMethod: bankBenchmarks.deliveryMethod,
        rate: bankBenchmarks.rate,
        fee: bankBenchmarks.fee,
        note: bankBenchmarks.note,
        pinned: bankBenchmarks.pinned,
        updatedAt: bankBenchmarks.updatedAt,
        corridorSlug: corridors.slug,
        countryName: corridors.fromCountryName,
        currency: corridors.fromCurrency,
      })
      .from(bankBenchmarks)
      .innerJoin(corridors, eq(corridors.id, bankBenchmarks.corridorId))
      .orderBy(corridors.fromCountryName, bankBenchmarks.deliveryMethod)

    return rows.map((row) => ({
      ...row,
      rate: toNum(row.rate),
      fee: toNum(row.fee),
    }))
  } catch (error) {
    console.error('[proof] listBenchmarks failed:', error)
    return []
  }
}

/** What a typical bank would deliver on this amount, or null with no benchmark. */
export function benchmarkReceived(benchmark: Benchmark | null, amount: number): number | null {
  if (!benchmark) return null
  return computeReceived(amount, benchmark.rate, benchmark.fee)
}

/**
 * Regenerate stale, unpinned benchmarks from the live mid-market rate.
 *
 * Runs at the end of each cron pass but only rewrites rows older than
 * `BENCHMARK_MAX_AGE_DAYS`, so `updated_at` stays a meaningful date on the
 * methodology page instead of resetting every fifteen minutes.
 */
export async function refreshBenchmarks(
  midMarketByCurrency: Map<SendCurrency, number>,
  methods: readonly DeliveryMethod[] = ['bank', 'wallet', 'cash'],
): Promise<{ written: number; skippedPinned: number }> {
  let written = 0
  let skippedPinned = 0

  try {
    const corridorRows = await db
      .select()
      .from(corridors)
      .where(eq(corridors.active, true))

    const cutoff = new Date(Date.now() - BENCHMARK_MAX_AGE_DAYS * 86_400_000)

    const upserts = []
    for (const corridor of corridorRows) {
      const mid = midMarketByCurrency.get(corridor.fromCurrency)
      const assumption = BENCHMARK_ASSUMPTIONS[corridor.fromCurrency]
      if (!mid || !assumption) continue

      const rate = toRate(mid * (1 - assumption.markupPercent / 100))
      const fee = toMoney(assumption.fee)
      const note =
        `Generated from the mid-market rate less ${assumption.markupPercent}%, ` +
        `plus a ${assumption.fee} ${corridor.fromCurrency} wire fee. Indicative, not a quote.`

      for (const method of methods) {
        // Insert when absent; update only an unpinned row that has gone stale.
        upserts.push(
          db
            .insert(bankBenchmarks)
            .values({ corridorId: corridor.id, deliveryMethod: method, rate, fee, note, pinned: false })
            .onConflictDoUpdate({
              target: [bankBenchmarks.corridorId, bankBenchmarks.deliveryMethod],
              set: { rate, fee, note, updatedAt: new Date() },
              setWhere: and(
                eq(bankBenchmarks.pinned, false),
                lt(bankBenchmarks.updatedAt, cutoff),
              ),
            })
            .returning({ id: bankBenchmarks.id }),
        )
      }
    }

    // One batch: an upsert that skipped its update returns no row.
    const results = (await runBatch(upserts)) as { id: number }[][]
    written = results.filter((rows) => rows.length > 0).length

    const [pinned] = await db
      .select({ n: count() })
      .from(bankBenchmarks)
      .where(eq(bankBenchmarks.pinned, true))
    skippedPinned = pinned?.n ?? 0
  } catch (error) {
    console.error('[proof] refreshBenchmarks failed:', error)
  }

  return { written, skippedPinned }
}
