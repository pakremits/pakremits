/**
 * Writing quotes: the history row and the latest row, always together.
 *
 * `rate_quotes` keeps every capture for 45 days, for the /admin history and
 * adapter health. `latest_quotes` keeps one row per provider, corridor, method
 * and amount, and is what everything that shows a price reads: the comparison
 * table, the /go savings lookup and the static data files. Each change below
 * writes both in the same D1 batch, which runs as one transaction, so a reader
 * never sees a latest row that disagrees with the newest history row.
 */
import { type SQL, and, eq, lt, ne, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { rowsChanged } from '@/lib/db/d1'
import { db, getDb, toMoney, toRate } from '@/lib/db'
import {
  type DeliveryMethod,
  type LatestQuote,
  type QuoteSource,
  latestQuotes,
  rateQuotes,
} from '@/lib/db/schema'

/**
 * How long a failing adapter's last good quote is re-served, marked stale,
 * before its row is dropped. Three missed daily refreshes: past that the old
 * figure says more about the outage than about the provider's price.
 */
export const STALE_CAP_MS = 3 * 24 * 60 * 60 * 1000

/** How long a manual quote stands with nothing newer, as for history rows. */
export const MANUAL_QUOTE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000

/** One provider's price for one corridor, method and amount. */
export interface QuoteSlot {
  providerId: number
  corridorId: number
  deliveryMethod: DeliveryMethod
  amountSent: number
}

export interface CapturedQuote extends QuoteSlot {
  rate: number
  fee: number
  amountReceived: number
  deliverySpeedText: string
  deliverySpeedMinutes: number | null
  promoFlag: boolean
  promoNote: string | null
  source: QuoteSource
  capturedAt: Date
}

export type QuoteChange =
  /** A new capture: a history row, and the slot's latest row replaced. */
  | { kind: 'fresh'; quote: CapturedQuote }
  /** The adapter failed: re-serve the slot's last good quote, marked stale. */
  | { kind: 'stale'; previous: LatestQuote; at: Date }
  /** The last good quote is past the stale cap: stop showing the slot. */
  | { kind: 'drop'; slot: QuoteSlot }

export function slotKey(slot: QuoteSlot): string {
  return `${slot.providerId}:${slot.corridorId}:${slot.deliveryMethod}:${slot.amountSent}`
}

/**
 * What to write when an adapter fails for a slot: re-serve the last good
 * quote while it is inside the stale cap, drop the slot once it is not, and
 * nothing when the slot has never been quoted.
 */
export function changeForFailure(previous: LatestQuote | undefined, now: Date): QuoteChange | null {
  if (!previous) return null
  if (now.getTime() - previous.lastGoodAt.getTime() > STALE_CAP_MS) {
    return { kind: 'drop', slot: previous }
  }
  return { kind: 'stale', previous, at: now }
}

const SLOT_COLUMNS = [
  latestQuotes.corridorId,
  latestQuotes.deliveryMethod,
  latestQuotes.amountSent,
  latestQuotes.providerId,
]

function isSlot(slot: QuoteSlot): SQL {
  return and(
    eq(latestQuotes.corridorId, slot.corridorId),
    eq(latestQuotes.deliveryMethod, slot.deliveryMethod),
    eq(latestQuotes.amountSent, slot.amountSent),
    eq(latestQuotes.providerId, slot.providerId),
  )!
}

/** The value an upsert was about to insert, for its DO UPDATE clause. */
function excluded(column: { name: string }): SQL {
  return sql.raw(`excluded."${column.name}"`)
}

function statementsFor(change: QuoteChange): BatchItem<'sqlite'>[] {
  if (change.kind === 'drop') {
    return [db.delete(latestQuotes).where(isSlot(change.slot))]
  }

  if (change.kind === 'stale') {
    const { previous, at } = change
    return [
      db.insert(rateQuotes).values({
        providerId: previous.providerId,
        corridorId: previous.corridorId,
        deliveryMethod: previous.deliveryMethod,
        amountSent: previous.amountSent,
        rate: previous.rate,
        fee: previous.fee,
        amountReceived: previous.amountReceived,
        deliverySpeedText: previous.deliverySpeedText,
        deliverySpeedMinutes: previous.deliverySpeedMinutes,
        promoFlag: previous.promoFlag,
        promoNote: previous.promoNote,
        source: previous.source,
        stale: true,
        capturedAt: at,
      }),
      db.update(latestQuotes).set({ stale: true, capturedAt: at }).where(isSlot(previous)),
    ]
  }

  const { quote } = change
  const row = {
    providerId: quote.providerId,
    corridorId: quote.corridorId,
    deliveryMethod: quote.deliveryMethod,
    amountSent: toMoney(quote.amountSent),
    rate: toRate(quote.rate),
    fee: toMoney(quote.fee),
    amountReceived: toMoney(quote.amountReceived),
    deliverySpeedText: quote.deliverySpeedText,
    deliverySpeedMinutes: quote.deliverySpeedMinutes,
    promoFlag: quote.promoFlag,
    promoNote: quote.promoNote,
    source: quote.source,
    stale: false,
    capturedAt: quote.capturedAt,
  }

  return [
    db.insert(rateQuotes).values(row),
    db
      .insert(latestQuotes)
      .values({ ...row, lastGoodAt: quote.capturedAt })
      .onConflictDoUpdate({
        target: SLOT_COLUMNS,
        set: {
          rate: excluded(latestQuotes.rate),
          fee: excluded(latestQuotes.fee),
          amountReceived: excluded(latestQuotes.amountReceived),
          deliverySpeedText: excluded(latestQuotes.deliverySpeedText),
          deliverySpeedMinutes: excluded(latestQuotes.deliverySpeedMinutes),
          promoFlag: excluded(latestQuotes.promoFlag),
          promoNote: excluded(latestQuotes.promoNote),
          source: excluded(latestQuotes.source),
          stale: excluded(latestQuotes.stale),
          capturedAt: excluded(latestQuotes.capturedAt),
          lastGoodAt: excluded(latestQuotes.lastGoodAt),
        },
      }),
  ]
}

/** Statements per D1 batch: one request over REST, one transaction on a binding. */
const BATCH_STATEMENTS = 50

/**
 * Apply changes in as few batches as fit. A change's statements always share
 * a batch, so its history and latest rows commit together.
 */
export async function applyQuoteChanges(changes: readonly QuoteChange[]): Promise<void> {
  let pending: BatchItem<'sqlite'>[] = []
  const flush = async () => {
    if (pending.length === 0) return
    const batch = pending as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]
    pending = []
    await getDb().batch(batch)
  }

  for (const change of changes) {
    const statements = statementsFor(change)
    if (pending.length + statements.length > BATCH_STATEMENTS) await flush()
    pending.push(...statements)
  }
  await flush()
}

/** Every latest row, keyed by `slotKey`. One read for a whole refresh. */
export async function loadLatestQuotes(): Promise<Map<string, LatestQuote>> {
  const rows = await db.select().from(latestQuotes)
  return new Map(rows.map((row) => [slotKey(row), row]))
}

/**
 * Drop latest rows nothing refreshes any more: an automated quote whose last
 * good capture is past the stale cap (an adapter retired, a provider made
 * inactive), or a manual quote older than history is kept.
 */
export async function pruneLatestQuotes(now = new Date()): Promise<number> {
  const result = await db
    .delete(latestQuotes)
    .where(
      or(
        and(
          ne(latestQuotes.source, 'manual'),
          lt(latestQuotes.lastGoodAt, new Date(now.getTime() - STALE_CAP_MS)),
        ),
        lt(latestQuotes.lastGoodAt, new Date(now.getTime() - MANUAL_QUOTE_MAX_AGE_MS)),
      ),
    )
    .run()
  return rowsChanged(result)
}
