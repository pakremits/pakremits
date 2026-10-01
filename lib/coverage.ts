/**
 * Which providers are actually quoted in which corridors, for deciding which
 * provider and head-to-head pages are worth indexing.
 *
 * A provider page with no live quote, or a head-to-head where the two services
 * meet in a single corridor, is mostly "not available" rows. Pages like that
 * are thin to a search engine and drag down how it rates the rest of the site,
 * so they are served with noindex, left out of the sitemap and not linked as
 * comparisons. The sitemap, the page metadata and the internal links all read
 * this one source, so they always agree.
 *
 * Measured the way those pages measure it: bank deposit at each corridor's
 * default amount. `cache` shares one result between a page's metadata and its
 * body in the same request.
 */
import { cache } from 'react'
import { CORRIDORS } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'

/** A head-to-head needs this many corridors with both providers quoted. */
export const MIN_SHARED_CORRIDORS = 2

/** provider slug → slugs of the corridors it has a live bank quote in. */
export const getProviderCoverage = cache(async (): Promise<Map<string, Set<string>>> => {
  const coverage = new Map<string, Set<string>>()
  const comparisons = await Promise.all(
    CORRIDORS.map((corridor) =>
      getComparison({ corridorSlug: corridor.slug, method: 'bank', includeBenchmark: false }).then(
        (comparison) => ({ corridor: corridor.slug, comparison }),
      ),
    ),
  )
  for (const { corridor, comparison } of comparisons) {
    for (const row of comparison?.rows ?? []) {
      const slug = row.quote.providerSlug
      if (!coverage.has(slug)) coverage.set(slug, new Set())
      coverage.get(slug)!.add(corridor)
    }
  }
  return coverage
})

export function sharedCorridorCount(coverage: Map<string, Set<string>>, a: string, b: string): number {
  const left = coverage.get(a)
  const right = coverage.get(b)
  if (!left || !right) return 0
  let shared = 0
  for (const corridor of left) if (right.has(corridor)) shared++
  return shared
}

/** Every pair worth a page, in the canonical order (alphabetically-first slug leads). */
export function strongPairs(coverage: Map<string, Set<string>>): [string, string][] {
  const slugs = [...coverage.keys()].sort()
  const pairs: [string, string][] = []
  for (let i = 0; i < slugs.length; i++)
    for (let j = i + 1; j < slugs.length; j++)
      if (sharedCorridorCount(coverage, slugs[i], slugs[j]) >= MIN_SHARED_CORRIDORS)
        pairs.push([slugs[i], slugs[j]])
  return pairs
}
