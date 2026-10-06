/**
 * Quotes in the browser: the static data files the build writes, ranked with
 * the same code the build used (lib/comparison.ts).
 *
 * The site is static, so there is no quotes API. Each corridor's latest quotes
 * ship as /data/quotes/{corridor}.json, fetched once per page load; a new
 * amount, payout or sort is then just arithmetic.
 */
import {
  type Comparison,
  type ComparisonOptions,
  type CorridorDataFile,
  comparisonFromSnapshot,
} from '@/lib/comparison'

const files = new Map<string, Promise<CorridorDataFile>>()

/** One corridor's data file. Cached for the page's lifetime; a failure is retried next time. */
export function loadCorridorData(corridorSlug: string): Promise<CorridorDataFile> {
  let file = files.get(corridorSlug)
  if (!file) {
    file = fetch(`/data/quotes/${encodeURIComponent(corridorSlug)}.json`).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${corridorSlug} quotes`)
      return response.json() as Promise<CorridorDataFile>
    })
    file.catch(() => files.delete(corridorSlug))
    files.set(corridorSlug, file)
  }
  return file
}

/** The ranked table for a selection, judged stale against the reader's clock. */
export async function loadComparison(
  corridorSlug: string,
  options: Omit<ComparisonOptions, 'now'>,
): Promise<Comparison> {
  return comparisonFromSnapshot(await loadCorridorData(corridorSlug), options)
}

/**
 * Count a comparison towards the public "comparisons this month" figure.
 *
 * Fire and forget: the Worker deduplicates to one per session per minute and
 * ignores a browser it has not seen before, so a failure here costs one count
 * and never the reader's results.
 */
export function recordComparison(corridorSlug: string): void {
  try {
    const body = JSON.stringify({ corridor: corridorSlug })
    const queued = navigator.sendBeacon?.(
      '/api/events',
      new Blob([body], { type: 'application/json' }),
    )
    if (!queued) {
      void fetch('/api/events', {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // Counting must never break the page.
  }
}
