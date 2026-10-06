import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  affiliateClicks,
  bankBenchmarks,
  comparisonEvents,
  savingsLedger,
  siteStatsDaily,
} from '@/lib/db/schema'
import { BENCHMARK_MAX_AGE_DAYS, refreshBenchmarks } from '@/lib/proof/benchmarks'
import {
  pruneComparisonEvents,
  recordBestProviderChange,
  recordComparisonRun,
  rollUpSiteStats,
  utcDay,
  utcDaysBack,
} from '@/lib/proof/events'
import { recordSaving } from '@/lib/proof/ledger'
import { getProofStats } from '@/lib/proof/stats'
import { applyQuoteChanges } from '@/lib/quotes-write'
import { type TestD1, addCorridor, addProvider, hoursAgo, startD1 } from './d1'

let d1: TestD1
beforeAll(async () => {
  d1 = await startD1()
})
afterAll(() => d1.dispose())
beforeEach(() => d1.reset())

let clickSeq = 0
async function addClick(providerId: number, corridorId: number | null, createdAt = new Date()) {
  const [row] = await db
    .insert(affiliateClicks)
    .values({ providerId, corridorId, clickId: `click-${++clickSeq}`, createdAt })
    .returning({ id: affiliateClicks.id })
  return row.id
}

describe('utcDaysBack', () => {
  it('lists the UTC days from `days` ago up to today', () => {
    expect(utcDaysBack(2, new Date('2026-10-06T23:30:00Z'))).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
    ])
  })
})

describe('comparison events', () => {
  it('records one event per session per minute', async () => {
    const corridorId = await addCorridor()
    await recordComparisonRun('session-a', corridorId)
    await recordComparisonRun('session-a', corridorId)
    await recordComparisonRun('session-b', corridorId)

    expect(await db.select().from(comparisonEvents)).toHaveLength(2)
  })

  it('prunes events older than the retention window', async () => {
    await db.insert(comparisonEvents).values([
      { sessionId: 'old', minuteBucket: hoursAgo(50 * 24), createdAt: hoursAgo(50 * 24) },
      { sessionId: 'new', minuteBucket: hoursAgo(1), createdAt: hoursAgo(1) },
    ])
    expect(await pruneComparisonEvents(45)).toBe(1)
    expect((await db.select().from(comparisonEvents)).map((row) => row.sessionId)).toEqual(['new'])
  })
})

describe('rollUpSiteStats', () => {
  it('recomputes each day idempotently and keeps the leader-change count', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const today = utcDay(new Date())
    const yesterday = utcDay(hoursAgo(24))

    await db.insert(comparisonEvents).values([
      { sessionId: 's1', minuteBucket: new Date(), corridorId },
      { sessionId: 's2', minuteBucket: new Date(), corridorId },
      { sessionId: 's3', minuteBucket: hoursAgo(24), corridorId, createdAt: hoursAgo(24) },
    ])
    const click = await addClick(providerId, corridorId)
    await addClick(providerId, corridorId)
    await db.insert(savingsLedger).values({
      affiliateClickId: click,
      corridorId,
      providerId,
      amountSent: 500,
      providerReceivedPkr: 183_000,
      bankReceivedPkr: 175_000.5,
      savingPkr: 7_999.5,
    })
    await recordBestProviderChange(2)

    expect(await rollUpSiteStats(3)).toBe(4)
    expect(await rollUpSiteStats(3)).toBe(4)

    const rows = new Map((await db.select().from(siteStatsDaily)).map((row) => [row.date, row]))
    expect(rows.size).toBe(4)
    expect(rows.get(today)).toMatchObject({
      comparisonsRun: 2,
      clicks: 2,
      savingPkrTotal: 7_999.5,
      bestProviderChanges: 2,
    })
    expect(rows.get(yesterday)).toMatchObject({ comparisonsRun: 1, clicks: 0, savingPkrTotal: 0 })
  })

  it('adds leader changes to today rather than replacing them', async () => {
    await recordBestProviderChange(1)
    await recordBestProviderChange(2)
    await recordBestProviderChange(0)
    const [row] = await db.select().from(siteStatsDaily)
    expect(row.bestProviderChanges).toBe(3)
  })
})

describe('recordSaving', () => {
  it('writes one ledger row per click, priced from the latest quote at the amount sent', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    await applyQuoteChanges([
      {
        kind: 'fresh',
        quote: {
          providerId,
          corridorId,
          deliveryMethod: 'bank',
          amountSent: 500,
          rate: 370,
          fee: 4,
          amountReceived: 183_520,
          deliverySpeedText: 'Same day',
          deliverySpeedMinutes: null,
          promoFlag: false,
          promoNote: null,
          source: 'api',
          capturedAt: new Date(),
        },
      },
    ])
    await db.insert(bankBenchmarks).values({ corridorId, deliveryMethod: 'bank', rate: 355, fee: 15 })
    const click = await addClick(providerId, corridorId)
    const input = {
      affiliateClickId: click,
      providerId,
      corridorId,
      currency: 'GBP' as const,
      amount: 520,
      method: 'bank' as const,
    }

    const saving = await recordSaving(input)
    await recordSaving(input)

    const rows = await db.select().from(savingsLedger)
    expect(rows).toHaveLength(1)
    // (520 - 4) × 370 against (520 - 15) × 355.
    expect(saving).toBe(190_920 - 179_275)
    expect(rows[0]).toMatchObject({ amountSent: 520, providerReceivedPkr: 190_920, savingPkr: 11_645 })
  })

  it('records nothing it cannot price', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const click = await addClick(providerId, corridorId)

    const saving = await recordSaving({
      affiliateClickId: click,
      providerId,
      corridorId,
      currency: 'GBP',
      amount: 500,
      method: 'bank',
    })
    expect(saving).toBeNull()
    expect(await db.select().from(savingsLedger)).toHaveLength(0)
  })
})

describe('refreshBenchmarks', () => {
  it('creates missing rows, regenerates stale unpinned ones and never touches pinned ones', async () => {
    const corridorId = await addCorridor()
    const mid = new Map([['GBP' as const, 370]])

    const first = await refreshBenchmarks(mid, ['bank', 'cash'])
    expect(first).toEqual({ written: 2, skippedPinned: 0 })

    // Inside the max age nothing is rewritten.
    expect((await refreshBenchmarks(mid, ['bank', 'cash'])).written).toBe(0)

    const old = new Date(Date.now() - (BENCHMARK_MAX_AGE_DAYS + 1) * 86_400_000)
    await db.update(bankBenchmarks).set({ updatedAt: old })
    await db
      .update(bankBenchmarks)
      .set({ pinned: true, rate: 360 })
      .where(eq(bankBenchmarks.deliveryMethod, 'cash'))

    expect(await refreshBenchmarks(mid, ['bank', 'cash'])).toEqual({ written: 1, skippedPinned: 1 })
    const rows = new Map((await db.select().from(bankBenchmarks)).map((row) => [row.deliveryMethod, row]))
    expect(rows.get('bank')?.rate).toBe(357.05) // 370 less 3.5%
    expect(rows.get('bank')?.updatedAt.getTime()).toBeGreaterThan(old.getTime())
    expect(rows.get('cash')?.rate).toBe(360)
    expect(rows.get('cash')?.updatedAt.getTime()).toBe(old.getTime())
    expect(rows.get('bank')?.corridorId).toBe(corridorId)
  })
})

describe('getProofStats', () => {
  it('sums the ledger and the month rollup, skipping clicks with no benchmark', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    await addProvider('typical-bank', { isBenchmark: true })
    const priced = await addClick(providerId, corridorId)
    const unpriced = await addClick(providerId, corridorId)
    await db.insert(savingsLedger).values([
      { affiliateClickId: priced, corridorId, providerId, amountSent: 500, providerReceivedPkr: 1, savingPkr: 1_250.25 },
      { affiliateClickId: unpriced, corridorId, providerId, amountSent: 500, providerReceivedPkr: 1, savingPkr: null },
    ])
    await db.insert(siteStatsDaily).values({ date: utcDay(new Date()), comparisonsRun: 40, bestProviderChanges: 3 })

    const stats = await getProofStats({ fresh: true })
    expect(stats).toMatchObject({
      savingsSinceLaunch: 1_250.25,
      savingsThisMonth: 1_250.25,
      comparisonsThisMonth: 40,
      bestProviderChangesThisMonth: 3,
      providersCompared: 1,
    })
    expect(stats.unavailable).toBeUndefined()
  })
})
