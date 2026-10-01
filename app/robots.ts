import type { MetadataRoute } from 'next'
import { searchIndexingEnabled } from '@/lib/seo'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  /*
   * Staging and previews are kept out of search by a noindex on every response
   * (the X-Robots-Tag header in next.config.ts, plus the robots meta tag), not
   * by `Disallow: /`. A crawler that is disallowed never fetches the page, so
   * it never sees the noindex, and a linked staging URL can still be listed.
   * The crawl rules below are therefore the same everywhere; only the sitemap
   * is withheld when indexing is off.
   */
  const indexing = searchIndexingEnabled()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          // Affiliate redirects. These mint a tracking id per request, so
          // crawling them would fill the clicks table with bot traffic and
          // corrupt the reporting the whole business model depends on.
          '/go/',
          // Alert URLs are capability tokens. Indexing one would publish it.
          '/alerts/',
          // Not the internal /corridor/, /rate/ and /method/ paths: they only
          // ever answer with a permanent redirect to the public URL, and a
          // disallow would stop Google from seeing where they lead.
        ],
      },
    ],
    ...(indexing ? { sitemap: `${SITE}/sitemap.xml`, host: SITE } : {}),
  }
}
