/**
 * The rate chart's ranges, shared by the interactive chart and the rate
 * page's banner line so the two always show the same window.
 */
import type { RateHistory, RatePoint } from '@/lib/quotes'

export type RangeKey = '24h' | '1w' | '1m' | '3m' | 'all'

export const DAY_MS = 24 * 60 * 60 * 1000

export const RANGES: { key: RangeKey; label: string; long: string; days?: number }[] = [
  { key: '24h', label: '24h', long: 'last 24 hours' },
  { key: '1w', label: '1W', long: 'last 7 days', days: 7 },
  { key: '1m', label: '1M', long: 'last 30 days', days: 30 },
  { key: '3m', label: '3M', long: 'last 90 days', days: 90 },
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

/** A fixed range needs this share of its window covered before it is offered. */
const MIN_COVERAGE = 0.8

/**
 * Whether a range has enough data to draw honestly.
 *
 * A fixed range (1W, 1M, 3M) needs its window at least 80% covered: drawing
 * 55 days under a "last 90 days" label would overstate the history. The same
 * rule the rate page's 7/30/90-day change figures use. "All" is offered only
 * when it reaches clearly further back than the longest fixed range that is.
 */
export function rangeAvailable(history: RateHistory, range: RangeKey): boolean {
  if (range === '24h') return history.intraday.length >= 2
  const daily = history.daily
  if (daily.length < 2) return false
  const covered = daily[daily.length - 1].t - daily[0].t
  if (range === 'all') {
    const longest = RANGES.filter((r) => r.days && covered >= r.days * DAY_MS * MIN_COVERAGE).at(-1)
    return covered > (longest?.days ?? 0) * DAY_MS * 1.05
  }
  const days = RANGES.find((r) => r.key === range)?.days ?? 0
  return covered >= days * DAY_MS * MIN_COVERAGE && pointsFor(history, range).length >= 2
}

/** Ranges that always show a tab, greyed out until there is history for them. */
export const ALWAYS_LISTED: readonly RangeKey[] = ['1w', '1m', '3m']

/** The requested range if it can be drawn, otherwise the widest that can. */
export function resolveRange(history: RateHistory, wanted: RangeKey | undefined): RangeKey | undefined {
  const usable = RANGES.filter((r) => rangeAvailable(history, r.key))
  return usable.find((r) => r.key === wanted)?.key ?? usable.at(-1)?.key
}
