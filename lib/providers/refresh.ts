/**
 * The refresh loop: fetch every provider × corridor × method × amount, and
 * persist the results.
 *
 * The one rule here is that nothing may throw past this boundary. A provider
 * changing its JSON shape at 3am must degrade to a stale badge on one row, not
 * an empty comparison table.
 */
import { eq, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rowsChanged } from '@/lib/db/d1'
import {
  type Corridor,
  type DeliveryMethod,
  type LatestQuote,
  type Provider,
  corridors,
  providers,
  rateQuotes,
} from '@/lib/db/schema'
import { CORRIDORS, STANDARD_AMOUNTS } from '@/lib/corridors'
import { computeReceived } from '@/lib/ranking/compute'
import {
  type QuoteChange,
  applyQuoteChanges,
  changeForFailure,
  loadLatestQuotes,
  pruneLatestQuotes,
  slotKey,
} from '@/lib/quotes-write'
import { activeAdapters, adaptersFor } from './registry'
import { AdapterError, jitteredDelay, type Quote, type QuoteRequest } from './types'

/** Delivery methods we ask every adapter about. */
const METHODS: readonly DeliveryMethod[] = ['bank', 'wallet', 'cash'] as const

export interface RefreshResult {
  quotesWritten: number
  adaptersOk: number
  adaptersFailed: number
  staleServed: number
  /** Slots whose last good quote passed the stale cap and stopped showing. */
  staleDropped: number
  failures: { provider: string; corridor: string; method: string; error: string }[]
  /** Batches that could not be written. Each one loses a corridor's results. */
  writeErrors: string[]
  durationMs: number
}

/**
 * Canonical received amount.
 *
 * Always computed in the `deducted` model regardless of how the provider itself
 * frames its fee, so every row answers the same question: "I have `amount` to
 * spend in total — what lands in Pakistan?" Comparing a fee-on-top provider at
 * face value against a fee-deducted one would silently favour the former.
 */
export function canonicalReceived(amount: number, quote: Quote): number {
  return computeReceived(amount, quote.rate, quote.fee, 'deducted')
}

/**
 * Quote one provider/corridor/method/amount slot.
 *
 * Returns what to write rather than writing it, so a corridor's results reach
 * D1 in one batch. On success that is the fresh quote. On failure it is the
 * slot's last good quote re-served with `stale: true`, so the page keeps a
 * number and the UI can say how old it is, until the stale cap drops it.
 */
async function quoteSlot(
  adapter: ReturnType<typeof adaptersFor>[number],
  provider: Provider,
  corridor: Corridor,
  request: QuoteRequest,
  latest: Map<string, LatestQuote>,
  result: RefreshResult,
): Promise<QuoteChange | null> {
  try {
    const quote = await adapter.getQuote(request)
    const received = canonicalReceived(request.amount, quote)

    if (received <= 0) {
      throw new AdapterError(adapter.slug, `computed a non-positive receive amount`)
    }

    result.adaptersOk += 1
    return {
      kind: 'fresh',
      quote: {
        providerId: provider.id,
        corridorId: corridor.id,
        deliveryMethod: request.method,
        amountSent: request.amount,
        rate: quote.rate,
        fee: quote.fee,
        amountReceived: received,
        deliverySpeedText: quote.deliverySpeedText,
        deliverySpeedMinutes: quote.deliverySpeedMinutes,
        promoFlag: quote.promo,
        promoNote: quote.promoNote,
        source: quote.source,
        capturedAt: quote.capturedAt,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result.adaptersFailed += 1
    result.failures.push({
      provider: adapter.slug,
      corridor: corridor.slug,
      method: request.method,
      error: message,
    })
    console.error(
      `[refresh] ${adapter.slug} ${corridor.slug}/${request.method}/${request.amount} failed:`,
      message,
    )

    // Degrade to the last good number rather than dropping the provider.
    const previous = latest.get(
      slotKey({
        providerId: provider.id,
        corridorId: corridor.id,
        deliveryMethod: request.method,
        amountSent: request.amount,
      }),
    )
    const change = changeForFailure(previous, new Date())
    if (change?.kind === 'stale') result.staleServed += 1
    if (change?.kind === 'drop') result.staleDropped += 1
    return change
  }
}

/** Write one corridor's results in as few D1 batches as fit. Never throws. */
async function writeChanges(
  corridor: Corridor,
  changes: QuoteChange[],
  result: RefreshResult,
): Promise<void> {
  if (changes.length === 0) return
  try {
    await applyQuoteChanges(changes)
    result.quotesWritten += changes.filter((change) => change.kind === 'fresh').length
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result.writeErrors.push(`${corridor.slug}: ${message}`)
    console.error(`[refresh] writing ${corridor.slug} failed:`, message)
  }
}

/**
 * Full refresh across every active corridor, method, and standard amount.
 *
 * Runs corridors sequentially and providers in parallel within a slot: that
 * keeps concurrent load on any single provider host to one request at a time
 * while still finishing the whole grid in a few minutes. Each corridor's
 * results are written once it finishes, so a crash mid-run keeps the
 * corridors already done.
 */
export async function refreshAllRates(): Promise<RefreshResult> {
  const started = Date.now()
  const result: RefreshResult = {
    quotesWritten: 0,
    adaptersOk: 0,
    adaptersFailed: 0,
    staleServed: 0,
    staleDropped: 0,
    failures: [],
    writeErrors: [],
    durationMs: 0,
  }

  const [providerRows, corridorRows, latest] = await Promise.all([
    db.select().from(providers).where(eq(providers.active, true)),
    db.select().from(corridors).where(eq(corridors.active, true)),
    loadLatestQuotes(),
  ])

  const providerBySlug = new Map(providerRows.map((p) => [p.slug, p]))

  try {
    for (const corridor of corridorRows) {
      const config = CORRIDORS.find((c) => c.slug === corridor.slug)
      if (!config) {
        console.warn(`[refresh] no static config for corridor "${corridor.slug}", skipping`)
        continue
      }

      const amounts = STANDARD_AMOUNTS[corridor.fromCurrency] ?? [100, 500, 1000, 2000]
      const changes: QuoteChange[] = []

      for (const method of METHODS) {
        for (const amount of amounts) {
          const request: QuoteRequest = {
            from: corridor.fromCurrency,
            fromCountry: config.fromCountry,
            fromCountry3: config.fromCountry3,
            to: 'PKR',
            amount,
            method,
          }

          const adapters = adaptersFor(request)

          await Promise.all(
            adapters.map(async (adapter) => {
              const provider = providerBySlug.get(adapter.slug)
              if (!provider) {
                console.warn(`[refresh] adapter "${adapter.slug}" has no provider row; run the seed`)
                return
              }
              const change = await quoteSlot(adapter, provider, corridor, request, latest, result)
              if (change) changes.push(change)
            }),
          )

          // Be a good citizen: space out our requests to each provider.
          await jitteredDelay()
        }
      }

      await writeChanges(corridor, changes, result)
    }
  } finally {
    await Promise.allSettled(activeAdapters().map((adapter) => adapter.dispose?.()))
  }

  result.durationMs = Date.now() - started
  return result
}

/**
 * Delete history older than `days`, and latest rows nothing refreshes any
 * more. Called at the end of each run so the table stays well inside D1's
 * free storage.
 */
export async function pruneOldQuotes(days = 45): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  const deleted = await db.delete(rateQuotes).where(lt(rateQuotes.capturedAt, cutoff)).run()
  await pruneLatestQuotes()
  return rowsChanged(deleted)
}
