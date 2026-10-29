/**
 * Search results, e.g. /compare?from=uk&to=bank&amount=500.
 *
 * A static shell: the page reads its query string and ranks the quotes in the
 * browser (components/compare-results-page.tsx). It is not indexed, because
 * every combination would otherwise be a thin duplicate of a corridor page.
 */
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CompareResultsPage } from '@/components/compare-results-page'
import { ResultsPageSkeleton } from '@/components/compare-skeletons'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { CORRIDORS, defaultAmountFor } from '@/lib/corridors'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: 'Compare money transfers to Pakistan | PakRemits',
    description:
      'Every major service sending to Pakistan, ranked by the exact rupees that land in the account.',
    // Indexed as /compare: the canonical drops the query string, so the
    // ?from=…&to=… variants fold into this one page.
    path: '/compare',
  }),
}

export default async function ComparePage() {
  const locale = DEFAULT_LOCALE
  setRequestLocale(locale)
  const tn = await getTranslations({ locale, namespace: 'nav' })

  const corridorOptions = CORRIDORS.map((c) => ({
    slug: c.slug,
    countryCode: c.fromCountry,
    countryName: c.fromCountryName,
    currency: c.fromCurrency,
    defaultAmount: defaultAmountFor(c.fromCurrency),
  }))

  return (
    // The query string exists only in the browser: the built page is this
    // skeleton until the results render.
    <Suspense fallback={<ResultsPageSkeleton />}>
      <CompareResultsPage corridors={corridorOptions} howWeRankLabel={tn('howWeRank')} />
    </Suspense>
  )
}
