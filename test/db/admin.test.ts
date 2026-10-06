import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { affiliateClicks, rateQuotes, siteStatsDaily } from '@/lib/db/schema'
import {
  adapterHealth,
  clickTotals,
  clicksByDay,
  monetisationGap,
  proofByDay,
} from '@/lib/admin/stats'
import { utcDay } from '@/lib/proof/events'
import { type TestD1, addCorridor, addProvider, hoursAgo, startD1 } from './d1'

let d1: TestD1
beforeAll(async () => {
  d1 = await startD1()
})
afterAll(() => d1.dispose())
beforeEach(() => d1.reset())

let clickSeq = 0
async function addClicks(providerId: number, corridorId: number | null, ...ages: number[]) {
  await db.insert(affiliateClicks).values(
    ages.map((hours) => ({ providerId, corridorId, clickId: `c${++clickSeq}`, createdAt: hoursAgo(hours) })),
  )
}

describe('admin click figures', () => {
  it('counts clicks today, in the last 7 and 30 days, and in all', async () => {
    const providerId = await addProvider('wise')
    const now = new Date()
    const sinceMidnight = (now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 3_600_000
    // One click certainly today, then 3, 10 and 40 days ago.
    await addClicks(providerId, null, sinceMidnight / 2, 3 * 24, 10 * 24, 40 * 24)

    expect(await clickTotals()).toEqual({ today: 1, last7: 2, last30: 3, allTime: 4 })
  })

  it('groups recent clicks by day, provider and corridor', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    const remitly = await addProvider('remitly')
    await addClicks(wise, corridorId, 1, 1)
    await addClicks(remitly, null, 1)
    await addClicks(wise, corridorId, 20 * 24)

    const rows = await clicksByDay(14)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ day: utcDay(hoursAgo(1)), provider: 'wise', corridor: 'UK', clicks: 2 })
    expect(rows[1]).toMatchObject({ provider: 'remitly', corridor: null, clicks: 1 })
  })

  it('reports which providers can earn on their clicks', async () => {
    const wise = await addProvider('wise', { affiliateUrlTemplate: 'https://wise.example/?c={clickId}' })
    await addProvider('remitly')
    await addProvider('typical-bank', { isBenchmark: true })
    await addClicks(wise, null, 1, 2)

    const gap = await monetisationGap()
    expect(gap).toEqual([
      { provider: 'wise', monetised: true, clicks: 2 },
      { provider: 'remitly', monetised: false, clicks: 0 },
    ])
  })
})

describe('adapterHealth', () => {
  it('counts fresh and stale captures in the window, per active provider', async () => {
    const corridorId = await addCorridor()
    const wise = await addProvider('wise')
    await addProvider('remitly')
    await addProvider('typical-bank', { isBenchmark: true })
    const base = {
      providerId: wise,
      corridorId,
      deliveryMethod: 'bank' as const,
      amountSent: 500,
      rate: 370,
      fee: 4,
      amountReceived: 183_520,
      deliverySpeedText: 'Same day',
    }
    await db.insert(rateQuotes).values([
      { ...base, source: 'api', capturedAt: hoursAgo(2) },
      { ...base, source: 'scrape', capturedAt: hoursAgo(1) },
      { ...base, source: 'api', stale: true, capturedAt: hoursAgo(1) },
      // Outside the window.
      { ...base, source: 'manual', capturedAt: hoursAgo(30) },
    ])

    const health = await adapterHealth(24)
    expect(health).toHaveLength(2)
    const wiseRow = health.find((row) => row.slug === 'wise')
    expect(wiseRow).toMatchObject({ freshRows: 2, staleRows: 1 })
    expect(wiseRow?.sources.sort()).toEqual(['api', 'scrape'])
    expect(wiseRow?.lastCapture?.getTime()).toBeGreaterThan(hoursAgo(1.5).getTime())
    expect(health.find((row) => row.slug === 'remitly')).toMatchObject({
      freshRows: 0,
      staleRows: 0,
      sources: [],
      lastCapture: null,
    })
  })
})

describe('proofByDay', () => {
  it('returns every day in the window, zero-filled where there is no row', async () => {
    await db.insert(siteStatsDaily).values({
      date: utcDay(hoursAgo(24)),
      comparisonsRun: 12,
      clicks: 3,
      savingPkrTotal: 4_500.5,
      bestProviderChanges: 1,
    })

    const days = await proofByDay(2)
    expect(days.map((day) => day.date)).toEqual([
      utcDay(hoursAgo(48)),
      utcDay(hoursAgo(24)),
      utcDay(new Date()),
    ])
    expect(days[1]).toMatchObject({ comparisonsRun: 12, clicks: 3, savingPkrTotal: 4_500.5, bestProviderChanges: 1 })
    expect(days[2]).toMatchObject({ comparisonsRun: 0, clicks: 0, savingPkrTotal: 0, bestProviderChanges: 0 })
  })
})
