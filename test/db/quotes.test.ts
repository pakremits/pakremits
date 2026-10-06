import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { bankBenchmarks, latestQuotes, midMarketRates, rateQuotes } from '@/lib/db/schema'
import { getComparison, getMidMarketHistory, getMidMarketSeries } from '@/lib/quotes'
import {
  type CapturedQuote,
  STALE_CAP_MS,
  applyQuoteChanges,
  changeForFailure,
  loadLatestQuotes,
  pruneLatestQuotes,
  slotKey,
} from '@/lib/quotes-write'
import { type TestD1, addCorridor, addProvider, hoursAgo, startD1 } from './d1'

let d1: TestD1
beforeAll(async () => {
  d1 = await startD1()
})
afterAll(() => d1.dispose())
beforeEach(() => d1.reset())

function quote(overrides: Partial<CapturedQuote> & Pick<CapturedQuote, 'providerId' | 'corridorId'>): CapturedQuote {
  return {
    deliveryMethod: 'bank',
    amountSent: 500,
    rate: 370.123456789,
    fee: 3.999,
    amountReceived: 183_582.39,
    deliverySpeedText: 'Same day',
    deliverySpeedMinutes: 600,
    promoFlag: false,
    promoNote: null,
    source: 'api',
    capturedAt: new Date(),
    ...overrides,
  }
}

describe('quote writes', () => {
  it('writes a history row and the latest row together, rounded as stored', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const capturedAt = hoursAgo(1)

    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId, corridorId, capturedAt }) }])

    const history = await db.select().from(rateQuotes)
    const latest = await db.select().from(latestQuotes)
    expect(history).toHaveLength(1)
    expect(latest).toHaveLength(1)
    expect(latest[0]).toMatchObject({ rate: 370.123457, fee: 4, stale: false, source: 'api' })
    expect(latest[0].capturedAt.getTime()).toBe(capturedAt.getTime())
    expect(latest[0].lastGoodAt.getTime()).toBe(capturedAt.getTime())
  })

  it('replaces the latest row for the same slot and keeps every capture in history', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')

    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId, corridorId, rate: 370, capturedAt: hoursAgo(24) }) }])
    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId, corridorId, rate: 371.5 }) }])

    expect(await db.select().from(rateQuotes)).toHaveLength(2)
    const latest = await db.select().from(latestQuotes)
    expect(latest).toHaveLength(1)
    expect(latest[0].rate).toBe(371.5)
  })

  it('re-serves the last good quote as stale without moving last_good_at', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const goodAt = hoursAgo(30)
    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId, corridorId, rate: 370, capturedAt: goodAt }) }])

    const previous = (await loadLatestQuotes()).get(
      slotKey({ providerId, corridorId, deliveryMethod: 'bank', amountSent: 500 }),
    )
    const now = new Date()
    const change = changeForFailure(previous, now)
    expect(change?.kind).toBe('stale')
    await applyQuoteChanges([change!])

    const [latest] = await db.select().from(latestQuotes)
    expect(latest).toMatchObject({ stale: true, rate: 370 })
    expect(latest.capturedAt.getTime()).toBe(now.getTime())
    expect(latest.lastGoodAt.getTime()).toBe(goodAt.getTime())

    const history = await db.select().from(rateQuotes).orderBy(asc(rateQuotes.capturedAt))
    expect(history.map((row) => [row.stale, row.rate])).toEqual([
      [false, 370],
      [true, 370],
    ])
  })

  it('drops a slot once its last good quote is past the stale cap', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const goodAt = new Date(Date.now() - STALE_CAP_MS - 60_000)
    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId, corridorId, capturedAt: goodAt }) }])

    const [previous] = await db.select().from(latestQuotes)
    const change = changeForFailure(previous, new Date())
    expect(change?.kind).toBe('drop')
    await applyQuoteChanges([change!])

    expect(await db.select().from(latestQuotes)).toHaveLength(0)
    // History is untouched: pruning it is by age, not by outage.
    expect(await db.select().from(rateQuotes)).toHaveLength(1)
  })

  it('writes nothing for a slot that has never been quoted', () => {
    expect(changeForFailure(undefined, new Date())).toBeNull()
  })

  it('splits many changes across batches without losing any', async () => {
    const corridorId = await addCorridor()
    const providerIds = await Promise.all(
      Array.from({ length: 40 }, (_, i) => addProvider(`provider-${i}`)),
    )
    // 40 changes × 2 statements is more than one 50-statement batch.
    await applyQuoteChanges(
      providerIds.map((providerId) => ({ kind: 'fresh' as const, quote: quote({ providerId, corridorId }) })),
    )

    expect(await db.select().from(latestQuotes)).toHaveLength(40)
    expect(await db.select().from(rateQuotes)).toHaveLength(40)
  })

  it('prunes automated latest rows past the stale cap but keeps recent manual ones', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    const sadapay = await addProvider('sadapay')
    const retired = await addProvider('retired')
    const old = new Date(Date.now() - STALE_CAP_MS - 60_000)

    await applyQuoteChanges([
      { kind: 'fresh', quote: quote({ providerId: wise, corridorId }) },
      { kind: 'fresh', quote: quote({ providerId: sadapay, corridorId, source: 'manual', capturedAt: old }) },
      { kind: 'fresh', quote: quote({ providerId: retired, corridorId, capturedAt: old }) },
    ])

    expect(await pruneLatestQuotes()).toBe(1)
    const left = await db.select({ providerId: latestQuotes.providerId }).from(latestQuotes)
    expect(left.map((row) => row.providerId).sort()).toEqual([wise, sadapay].sort())

    // A manual quote goes once it is older than history is kept.
    expect(await pruneLatestQuotes(new Date(Date.now() + 46 * 86_400_000))).toBe(2)
  })
})

describe('getComparison', () => {
  it('ranks the latest quotes for the slot, with the benchmark row below them', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    const remitly = await addProvider('remitly')
    const hidden = await addProvider('hidden', { active: false })
    await applyQuoteChanges([
      { kind: 'fresh', quote: quote({ providerId: wise, corridorId, rate: 370, fee: 4 }) },
      { kind: 'fresh', quote: quote({ providerId: remitly, corridorId, rate: 372, fee: 2 }) },
      { kind: 'fresh', quote: quote({ providerId: hidden, corridorId, rate: 400, fee: 0 }) },
      // Another amount band and another rail must not leak into this table.
      { kind: 'fresh', quote: quote({ providerId: wise, corridorId, amountSent: 1000, rate: 380 }) },
      { kind: 'fresh', quote: quote({ providerId: wise, corridorId, deliveryMethod: 'cash', rate: 390 }) },
    ])
    await db.insert(bankBenchmarks).values({ corridorId, deliveryMethod: 'bank', rate: 355, fee: 15 })

    const comparison = await getComparison({ corridorSlug: 'uk', amount: 520 })

    expect(comparison?.quotedAtAmount).toBe(500)
    expect(comparison?.rows.map((row) => row.quote.providerSlug)).toEqual([
      'remitly',
      'wise',
      'typical-bank',
    ])
    // Received is recomputed for the amount asked for, not the band's.
    expect(comparison?.rows[0].quote.amountReceived).toBe(Math.round((520 - 2) * 372 * 100) / 100)
    expect(comparison?.savingVsBank).toBeGreaterThan(0)
  })

  it('serves named-account rails from the bank-deposit quotes', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId: wise, corridorId }) }])

    const comparison = await getComparison({ corridorSlug: 'uk', method: 'neobank', amount: 500 })
    expect(comparison?.deliveryMethod).toBe('bank')
    expect(comparison?.rows).toHaveLength(1)
  })

  it('returns null for an unknown corridor', async () => {
    expect(await getComparison({ corridorSlug: 'nowhere' })).toBeNull()
  })
})

describe('mid-market series', () => {
  async function addReadings(readings: [Date, number][]) {
    await db.insert(midMarketRates).values(
      readings.map(([capturedAt, rate]) => ({ fromCurrency: 'GBP' as const, rate, capturedAt, source: 'test' })),
    )
  }

  it('takes the last reading of each UTC day, oldest first', async () => {
    const day = Date.UTC(2026, 8, 10)
    await addReadings([
      [new Date(day + 1 * 3_600_000), 370],
      [new Date(day + 20 * 3_600_000), 371],
      [new Date(day + 86_400_000 + 5 * 3_600_000), 372],
    ])

    const series = await getMidMarketSeries('GBP', 7)
    expect(series.points.map((p) => [p.date.toISOString().slice(0, 10), p.rate])).toEqual([
      ['2026-09-10', 371],
      ['2026-09-11', 372],
    ])
    expect(series.latest).toBe(372)
    expect(series.changePercent).toBeCloseTo(((372 - 371) / 371) * 100, 2)
  })

  it('counts the window back from the newest reading, not from now', async () => {
    // A refresh that stopped 20 days ago: the 7-day window must still hold
    // the 7 days before that last reading.
    const newest = Date.now() - 20 * 86_400_000
    await addReadings(
      Array.from({ length: 12 }, (_, i): [Date, number] => [new Date(newest - i * 86_400_000), 370 + i]),
    )

    const series = await getMidMarketSeries('GBP', 7)
    expect(series.points).toHaveLength(7)
    expect(series.points.at(-1)?.date.getTime()).toBeLessThanOrEqual(newest)
  })

  it('returns intraday readings from the 24 hours before the newest one', async () => {
    const newest = Date.now()
    await addReadings([
      [new Date(newest - 30 * 3_600_000), 369],
      [new Date(newest - 12 * 3_600_000), 370],
      [new Date(newest), 371],
    ])

    const history = await getMidMarketHistory('GBP', 30)
    expect(history.intraday.map((point) => point.rate)).toEqual([370, 371])
    expect(history.daily.length).toBeGreaterThan(0)
  })
})

describe('latest rows in the refresh map', () => {
  it('keys every latest row by its slot', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    await applyQuoteChanges([{ kind: 'fresh', quote: quote({ providerId: wise, corridorId, amountSent: 1000 }) }])

    const latest = await loadLatestQuotes()
    const key = slotKey({ providerId: wise, corridorId, deliveryMethod: 'bank', amountSent: 1000 })
    expect(latest.get(key)?.amountSent).toBe(1000)
    expect([...latest.keys()]).toEqual([key])
    const [row] = await db.select().from(latestQuotes).where(eq(latestQuotes.providerId, wise))
    expect(row.amountSent).toBe(1000)
  })
})
