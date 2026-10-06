import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { latestQuotes, rateQuotes } from '@/lib/db/schema'
import type { ProviderAdapter, QuoteRequest } from '@/lib/providers/types'
import { STALE_CAP_MS } from '@/lib/quotes-write'
import { pruneOldQuotes, refreshAllRates } from '@/lib/providers/refresh'
import { type TestD1, addCorridor, addProvider, hoursAgo, startD1 } from './d1'

/** Which fake adapters fail on the next run. */
const failing = vi.hoisted(() => new Set<string>())

vi.mock('@/lib/providers/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers/types')>()),
  // The real one waits up to a second between slots.
  jitteredDelay: async () => {},
}))

vi.mock('@/lib/providers/registry', async () => {
  const { AdapterError } = await import('@/lib/providers/types')
  const fake = (slug: string, rate: number): ProviderAdapter => ({
    slug,
    name: slug,
    runtime: 'http',
    source: 'api',
    supports: (request: QuoteRequest) => request.method === 'bank',
    getQuote: async () => {
      if (failing.has(slug)) throw new AdapterError(slug, 'down for the test')
      return {
        providerSlug: slug,
        rate,
        fee: 2,
        feeModel: 'deducted',
        providerQuotedReceive: null,
        deliverySpeedText: 'Same day',
        deliverySpeedMinutes: 600,
        promo: false,
        promoNote: null,
        source: 'api',
        capturedAt: new Date(),
      }
    },
  })
  const adapters = [fake('wise', 370), fake('remitly', 371)]
  return {
    activeAdapters: () => adapters,
    adaptersFor: (request: QuoteRequest) => adapters.filter((adapter) => adapter.supports(request)),
  }
})

let d1: TestD1
beforeAll(async () => {
  d1 = await startD1()
})
afterAll(() => d1.dispose())
beforeEach(async () => {
  await d1.reset()
  failing.clear()
  // The failures here are the point of the test; keep them out of the output.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

async function latestFor(providerId: number) {
  return db.select().from(latestQuotes).where(eq(latestQuotes.providerId, providerId))
}

describe('refreshAllRates', () => {
  it('writes every slot, re-serves a failing provider as stale, then drops it past the cap', async () => {
    await addCorridor('uk', 'GBP', 'GB')
    await addProvider('wise')
    const remitly = await addProvider('remitly')

    // Bank only, at the four GBP amounts, for two providers.
    const first = await refreshAllRates()
    expect(first).toMatchObject({ quotesWritten: 8, adaptersOk: 8, adaptersFailed: 0, writeErrors: [] })
    expect(await db.select().from(latestQuotes)).toHaveLength(8)

    failing.add('remitly')
    const second = await refreshAllRates()
    expect(second).toMatchObject({ quotesWritten: 4, adaptersFailed: 4, staleServed: 4, staleDropped: 0 })
    const stale = await latestFor(remitly)
    expect(stale).toHaveLength(4)
    expect(stale.every((row) => row.stale && row.rate === 371)).toBe(true)

    // Three days on, the old figure is no longer worth showing.
    await db
      .update(latestQuotes)
      .set({ lastGoodAt: new Date(Date.now() - STALE_CAP_MS - 60_000) })
      .where(eq(latestQuotes.providerId, remitly))
    const third = await refreshAllRates()
    expect(third).toMatchObject({ staleServed: 0, staleDropped: 4 })
    expect(await latestFor(remitly)).toHaveLength(0)

    // History: 8 + 4 fresh + 4 stale + 4 fresh.
    expect(await db.select().from(rateQuotes)).toHaveLength(20)
  })

  it('skips adapters without a provider row instead of failing the run', async () => {
    await addCorridor('uk', 'GBP', 'GB')
    await addProvider('wise')

    const result = await refreshAllRates()
    expect(result).toMatchObject({ quotesWritten: 4, adaptersFailed: 0 })
  })
})

describe('pruneOldQuotes', () => {
  it('deletes history past the retention window and returns the count', async () => {
    const corridorId = await addCorridor()
    const providerId = await addProvider('wise')
    const row = {
      providerId,
      corridorId,
      deliveryMethod: 'bank' as const,
      amountSent: 500,
      rate: 370,
      fee: 4,
      amountReceived: 183_520,
      deliverySpeedText: 'Same day',
      source: 'api' as const,
    }
    await db.insert(rateQuotes).values([
      { ...row, capturedAt: hoursAgo(46 * 24) },
      { ...row, capturedAt: hoursAgo(47 * 24) },
      { ...row, capturedAt: hoursAgo(1) },
    ])

    expect(await pruneOldQuotes(45)).toBe(2)
    expect(await db.select().from(rateQuotes)).toHaveLength(1)
  })
})
