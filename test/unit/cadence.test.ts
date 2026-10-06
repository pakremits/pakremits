import { describe, expect, it } from 'vitest'
import {
  REFRESH_INTERVAL_MINUTES,
  STALE_AFTER_MS,
  isOutOfDate,
  refreshCadence,
  staleAfterPhrase,
} from '@/lib/cadence'

describe('refresh cadence', () => {
  it('defaults to once a day, the staging cadence', () => {
    expect(REFRESH_INTERVAL_MINUTES).toBe(1440)
    expect(refreshCadence()).toBe('once a day')
    expect(staleAfterPhrase()).toBe('36 hours')
  })

  it('names other intervals the way a reader would', () => {
    expect(refreshCadence('en', 480)).toBe('every 8 hours')
    expect(refreshCadence('en', 60)).toBe('every hour')
    expect(refreshCadence('en', 15)).toBe('every 15 minutes')
    expect(refreshCadence('en', 2880)).toBe('every 2 days')
    expect(refreshCadence('ur', 1440)).toBe('روزانہ ایک بار')
  })

  it('flags a capture once it is one and a half intervals old', () => {
    const now = Date.UTC(2026, 9, 6)
    expect(STALE_AFTER_MS).toBe(1440 * 60_000 * 1.5)
    expect(isOutOfDate(now - STALE_AFTER_MS, now)).toBe(false)
    expect(isOutOfDate(new Date(now - STALE_AFTER_MS - 1), now)).toBe(true)
  })
})
