import '@/lib/db/static-build'
import type { MetadataRoute } from 'next'
import { and, eq, max } from 'drizzle-orm'
import { CORRIDORS } from '@/lib/corridors'
import { db } from '@/lib/db'
import { latestQuotes, providers } from '@/lib/db/schema'
import { METHOD_CONTENT } from '@/lib/content/methods'
import { getProviderCoverage, strongPairs } from '@/lib/coverage'
import { methodPath } from '@/lib/routes'

/**
 * The sitemap, written as /sitemap.xml when the site is built.
 *
 * Lists every canonical public page worth indexing. Private alert URLs,
 * admin/API routes, affiliate redirects, the internal rewrite targets and the
 * thin head-to-head pages (served noindex, see lib/coverage.ts) stay out.
 *
 * `lastModified` is only given where it is true: pages built on live quotes
 * changed when the newest quote was captured. Static pages carry none rather
 * than a fresh "now" on every fetch, which search engines learn to ignore.
 *
 * No hreflang alternates: Urdu is switched off for now (ENABLED_LOCALES in
 * i18n/routing.ts), and claiming an alternate that redirects is worse than
 * omitting it.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const dynamic = 'force-static'

/** When the newest quote was captured; undefined before the first refresh. */
async function latestQuoteAt(): Promise<Date | undefined> {
  const [row] = await db.select({ at: max(latestQuotes.capturedAt) }).from(latestQuotes)
  return row?.at ?? undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [quotedAt, coverage] = await Promise.all([latestQuoteAt(), getProviderCoverage()])

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: quotedAt, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/compare`, lastModified: quotedAt, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/how-we-rank`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/providers`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE}/about`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/affiliate-disclosure`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const corridorPages: MetadataRoute.Sitemap = CORRIDORS.map((corridor) => ({
    url: `${SITE}/compare/${corridor.slug}-to-pakistan`,
    lastModified: quotedAt,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  const ratePages: MetadataRoute.Sitemap = CORRIDORS.map((corridor) => ({
    url: `${SITE}/${corridor.fromCurrency.toLowerCase()}-to-pkr`,
    lastModified: quotedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const methodPages: MetadataRoute.Sitemap = METHOD_CONTENT.map((entry) => ({
    url: `${SITE}${methodPath(entry.slug)}`,
    lastModified: quotedAt,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  /**
   * Every provider page, quoted live or not: people search for providers by
   * name. Only the quoted ones changed with the newest quote.
   */
  const providerRows = await db
    .select({ slug: providers.slug })
    .from(providers)
    .where(and(eq(providers.active, true), eq(providers.isBenchmark, false)))

  const providerPages: MetadataRoute.Sitemap = providerRows.map((row) => ({
    url: `${SITE}/providers/${row.slug}`,
    ...((coverage.get(row.slug)?.size ?? 0) > 0 ? { lastModified: quotedAt } : {}),
    changeFrequency: 'daily' as const,
    priority: 0.5,
  }))

  /**
   * Head-to-head pages: only pairs quoted together in at least
   * MIN_SHARED_CORRIDORS corridors. The alphabetically-first slug always
   * leads; emitting both orders would create duplicates competing for the
   * same query.
   */
  const comparePages: MetadataRoute.Sitemap = strongPairs(coverage).map(([a, b]) => ({
    url: `${SITE}/compare/${a}-vs-${b}`,
    lastModified: quotedAt,
    changeFrequency: 'daily' as const,
    priority: 0.5,
  }))

  return [
    ...staticPages,
    ...corridorPages,
    ...ratePages,
    ...methodPages,
    ...providerPages,
    ...comparePages,
  ]
}
