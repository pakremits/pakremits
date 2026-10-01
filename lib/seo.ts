import type { Metadata } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Indexing is opt-in so a newly deployed staging or preview app stays private to crawlers. */
export function searchIndexingEnabled(): boolean {
  return process.env.ROBOTS_ALLOW_INDEXING === 'true'
}

/** Keep search and social previews aligned while each page supplies its own copy. */
export function publicPageMetadata({
  title,
  description,
  path,
  alternates,
  image = '/opengraph-image',
  type = 'website',
}: {
  title: string
  description: string
  path: string
  alternates?: Metadata['alternates']
  image?: string
  type?: 'website' | 'article'
}): Metadata {
  const url = new URL(path, site).toString()
  const imageUrl = new URL(image, site).toString()
  return {
    title,
    description,
    alternates: alternates ?? { canonical: path },
    openGraph: {
      title,
      description,
      url,
      siteName: 'PakRemits',
      type,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageUrl, alt: title }],
    },
  }
}

/**
 * JSON for a `<script type="application/ld+json">` body. JSON.stringify leaves
 * `<` as is, so a value containing `</script>` (a provider name or note from
 * the database, say) would close the tag early and run what follows. `\u003c`
 * is the same character to a JSON parser and inert to the HTML one.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
