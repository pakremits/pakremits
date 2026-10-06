/**
 * The /compare results page's chrome.
 *
 * The header and footer live here rather than in the page so that loading.tsx,
 * which Next shows the moment a Compare click leaves the home page, sits
 * between them. The route group keeps that loading state off /compare/[slug],
 * whose pages look nothing like the results list.
 */
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { DEFAULT_LOCALE } from '@/i18n/routing'

export default async function CompareResultsLayout({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE
  setRequestLocale(locale)

  return (
    <>
      <SiteHeader locale={locale} active="compare" />
      {children}
      <SiteFooter locale={locale} />
    </>
  )
}
