import { describe, expect, it } from 'vitest'
import { DAY_MS, rangeAvailable, resolveRange } from '@/lib/rate-ranges'
import type { RateHistory } from '@/lib/quotes'

/** One reading a day for `days` days, ending now. */
function history(days: number, intraday = 0): RateHistory {
  const end = Date.UTC(2026, 9, 1)
  return {
    daily: Array.from({ length: days }, (_, i) => ({ t: end - (days - 1 - i) * DAY_MS, rate: 360 + i * 0.1 })),
    intraday: Array.from({ length: intraday }, (_, i) => ({ t: end - (intraday - i) * 15 * 60_000, rate: 367 })),
  }
}

describe('rate chart ranges', () => {
  it('with 55 days: 1W and 1M, no 3M yet, and All for the 55 days', () => {
    const h = history(55)
    expect(rangeAvailable(h, '1w')).toBe(true)
    expect(rangeAvailable(h, '1m')).toBe(true)
    expect(rangeAvailable(h, '3m')).toBe(false)
    expect(rangeAvailable(h, 'all')).toBe(true)
  })

  it('offers 3M once 80% of the 90 days is covered, and drops All when it adds nothing', () => {
    const h = history(80)
    expect(rangeAvailable(h, '3m')).toBe(true)
    expect(rangeAvailable(h, 'all')).toBe(false)
  })

  it('brings All back when the history reaches well past 90 days', () => {
    expect(rangeAvailable(history(200), 'all')).toBe(true)
  })

  it('needs intraday captures for 24h', () => {
    expect(rangeAvailable(history(55), '24h')).toBe(false)
    expect(rangeAvailable(history(55, 2), '24h')).toBe(false)
    expect(rangeAvailable(history(55, 96), '24h')).toBe(true)
  })

  it('falls back to the widest available range when the wanted one is not', () => {
    expect(resolveRange(history(55), '3m')).toBe('all')
    // 20 days: 1M is not offered (it needs 24), so All carries the 20 days.
    expect(rangeAvailable(history(20), '1m')).toBe(false)
    expect(resolveRange(history(20), '1m')).toBe('all')
  })
})
