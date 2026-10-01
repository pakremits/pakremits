/**
 * The rate chart's ranges, shared by the interactive chart and the rate
 * page's banner line so the two always show the same window.
 */
import type { RateHistory, RatePoint } from '@/lib/quotes'

export type RangeKey = '24h' | '1w' | '1m' | 'all'

export const DAY_MS = 24 * 60 * 60 * 1000

export const RANGES: { key: RangeKey; label: string; long: string; days?: number }[] = [
  { key: '24h', label: '24h', long: 'last 24 hours' },
  { key: '1w', label: '1W', long: 'last 7 days', days: 7 },
  { key: '1m', label: '1M', long: 'last 30 days', days: 30 },
  { key: 'all', label: 'All', long: 'all history' },
]

export function pointsFor(history: RateHistory, range: RangeKey): RatePoint[] {
  if (range === '24h') return history.intraday
  const daily = history.daily
  const spec = RANGES.find((r) => r.key === range)
  if (!spec?.days || daily.length === 0) return daily
  const cutoff = daily[daily.length - 1].t - spec.days * DAY_MS
  return daily.filter((point) => point.t >= cutoff)
}

/** Whether a range has enough data to draw. */
export function rangeAvailable(history: RateHistory, range: RangeKey): boolean {
  if (range === '24h') return history.intraday.length >= 2
  const daily = history.daily
  if (daily.length < 2) return false
  const covered = daily[daily.length - 1].t - daily[0].t
  // "All" is only worth a tab when it shows more than the month view does.
  if (range === 'all') return covered > 31 * DAY_MS
  return pointsFor(history, range).length >= 2
}

/** The requested range if it can be drawn, otherwise the widest that can. */
export function resolveRange(history: RateHistory, wanted: RangeKey | undefined): RangeKey | undefined {
  const usable = RANGES.filter((r) => rangeAvailable(history, r.key))
  return usable.find((r) => r.key === wanted)?.key ?? usable.at(-1)?.key
}
