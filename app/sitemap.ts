import type { MetadataRoute } from 'next'
import { and, eq } from 'drizzle-orm'
import { CORRIDORS } from '@/lib/corridors'
import { db } from '@/lib/db'
import { providers, rateQuotes } from '@/lib/db/schema'
import { METHOD_CONTENT } from '@/lib/content/methods'
import { methodPath } from '@/lib/routes'

/**
 * Dynamic sitemap.
 *
 * Lists every canonical public page. Private alert URLs, admin/API routes,
 * affiliate redirects and the internal rewrite targets must stay out.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Attach hreflang alternates to an entry.
 *
 * Only the page types that actually have an Urdu version get them — claiming an
 * alternate that 404s or serves identical English is worse than omitting it,
 * because Google treats a broken hreflang cluster as a signal problem across
 * every page in it.
 */
function withUrdu(path: string) {
  return {
    languages: {
      'en-GB': `${SITE}${path}`,
      'ur-PK': `${SITE}/ur${path === '/' ? '' : path}`,
    },
  }
}

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
      alternates: withUrdu('/'),
    },
    { url: `${SITE}/how-we-rank`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/providers`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    {
      url: `${SITE}/affiliate-disclosure`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const corridorPages: MetadataRoute.Sitemap = CORRIDORS.map((corridor) => ({
    url: `${SITE}/compare/${corridor.slug}-to-pakistan`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.9,
    alternates: withUrdu(`/compare/${corridor.slug}-to-pakistan`),
  }))

  const ratePages: MetadataRoute.Sitemap = CORRIDORS.map((corridor) => ({
    url: `${SITE}/${corridor.fromCurrency.toLowerCase()}-to-pkr`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.8,
    alternates: withUrdu(`/${corridor.fromCurrency.toLowerCase()}-to-pkr`),
  }))

  /** Public provider pages include catalogue-only providers and exclude the bank benchmark. */
  let providerPages: MetadataRoute.Sitemap = []
  try {
    const rows = await db
      .select({ slug: providers.slug })
      .from(providers)
      .where(and(eq(providers.active, true), eq(providers.isBenchmark, false)))

    providerPages = rows.map((row) => ({
      url: `${SITE}/providers/${row.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.5,
    }))
  } catch (error) {
    // Keep the static and country pages available during a database outage.
    console.error('[sitemap] could not list providers:', error)
  }

  const methodPages: MetadataRoute.Sitemap = METHOD_CONTENT.map((entry) => ({
    url: `${SITE}${methodPath(entry.slug)}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  /**
   * Head-to-head pages, one per unordered pair of quotable providers. The
   * alphabetically-first slug always leads — emitting both orders would create
   * duplicates competing for the same query.
   */
  let comparePages: MetadataRoute.Sitemap = []
  try {
    const rows = await db
      .selectDistinct({ slug: providers.slug })
      .from(rateQuotes)
      .innerJoin(providers, eq(rateQuotes.providerId, providers.id))
      .where(and(eq(providers.active, true), eq(providers.isBenchmark, false)))

    const slugs = rows.map((r) => r.slug).sort()
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        comparePages.push({
          url: `${SITE}/compare/${slugs[i]}-vs-${slugs[j]}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.5,
        })
      }
    }
  } catch (error) {
    console.error('[sitemap] could not build comparison pairs:', error)
    comparePages = []
  }

  return [
    ...staticPages,
    ...corridorPages,
    ...ratePages,
    ...methodPages,
    ...providerPages,
    ...comparePages,
  ]
}
