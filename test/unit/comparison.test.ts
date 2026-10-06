import { describe, expect, it } from 'vitest'
import { STALE_AFTER_MS } from '@/lib/cadence'
import {
  type QuoteSnapshot,
  type SnapshotQuote,
  comparisonFromSnapshot,
  nearestStandardAmount,
  quotedMethod,
} from '@/lib/comparison'

const NOW = Date.UTC(2026, 9, 6, 12)

function quote(overrides: Partial<SnapshotQuote>): SnapshotQuote {
  return {
    providerSlug: 'wise',
    providerName: 'Wise',
    brandColor: '#163300',
    brandTextColor: '#9FE870',
    featured: false,
    hasAffiliateLink: true,
    deliveryMethod: 'bank',
    amountSent: 500,
    rate: 370,
    fee: 4,
    deliverySpeedText: 'Same day',
    deliverySpeedMinutes: 600,
    promo: false,
    promoNote: null,
    source: 'api',
    stale: false,
    capturedAt: NOW - 60_000,
    ...overrides,
  }
}

const snapshot: QuoteSnapshot = {
  corridorSlug: 'uk',
  corridorId: 1,
  fromCurrency: 'GBP',
  midMarketRate: 375,
  benchmarks: { bank: { rate: 355, fee: 15, updatedAt: NOW - 86_400_000 } },
  quotes: [
    quote({}),
    quote({ providerSlug: 'remitly', providerName: 'Remitly', rate: 372, fee: 2, deliverySpeedMinutes: 30 }),
    // Other bands and rails must stay out of a 500 GBP bank table.
    quote({ amountSent: 1000, rate: 380 }),
    quote({ deliveryMethod: 'cash', rate: 390 }),
  ],
}

describe('comparisonFromSnapshot', () => {
  it('ranks the band nearest the amount by rupees received, for the amount asked', () => {
    const comparison = comparisonFromSnapshot(snapshot, { amount: 520, now: NOW })

    expect(comparison.quotedAtAmount).toBe(500)
    expect(comparison.rows.map((row) => row.quote.providerSlug)).toEqual(['remitly', 'wise', 'typical-bank'])
    expect(comparison.rows[0]).toMatchObject({ isBest: true, quote: { amountReceived: 192_696 } })
    expect(comparison.savingVsBank).toBe(192_696 - (520 - 15) * 355)
    expect(comparison.capturedAt?.getTime()).toBe(NOW - 60_000)
    expect(comparison.stale).toBe(false)
  })

  it('re-sorts without changing which row is best', () => {
    const comparison = comparisonFromSnapshot(snapshot, { amount: 500, sortBy: 'lowest-fee', now: NOW })
    expect(comparison.rows[0].quote.providerSlug).toBe('remitly')
    expect(comparison.rows.find((row) => row.isBest)?.quote.providerSlug).toBe('remitly')
  })

  it('serves named-account destinations from the bank rail', () => {
    expect(quotedMethod('rda')).toBe('bank')
    expect(quotedMethod('neobank')).toBe('bank')
    expect(quotedMethod('wallet')).toBe('wallet')
    expect(comparisonFromSnapshot(snapshot, { method: 'rda', now: NOW }).deliveryMethod).toBe('bank')
  })

  it('leaves the benchmark out when asked, and when no provider is quoted', () => {
    expect(
      comparisonFromSnapshot(snapshot, { includeBenchmark: false, now: NOW }).rows.some(
        (row) => row.quote.isBenchmark,
      ),
    ).toBe(false)
    expect(comparisonFromSnapshot(snapshot, { method: 'wallet', now: NOW }).rows).toEqual([])
  })

  it('is stale when a row re-serves a failed quote, or the oldest capture is past the threshold', () => {
    const reserved = { ...snapshot, quotes: [quote({ stale: true })] }
    expect(comparisonFromSnapshot(reserved, { now: NOW }).stale).toBe(true)

    const old = { ...snapshot, quotes: [quote({ capturedAt: NOW - STALE_AFTER_MS - 1 })] }
    expect(comparisonFromSnapshot(old, { now: NOW }).stale).toBe(true)
    expect(comparisonFromSnapshot(old, { now: NOW - 2 }).stale).toBe(false)
  })
})

describe('nearestStandardAmount', () => {
  it('snaps to the closest grid amount for the currency', () => {
    expect(nearestStandardAmount('GBP', 760)).toBe(1000)
    expect(nearestStandardAmount('GBP', 740)).toBe(500)
    expect(nearestStandardAmount('AED', 100)).toBe(500)
  })
})
