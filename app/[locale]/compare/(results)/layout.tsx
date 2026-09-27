/**
 * The /compare results page's chrome.
 *
 * The header and footer live here rather than in the page so that loading.tsx,
 * which Next shows the moment a Compare click leaves the home page, sits
 * between them. The route group keeps that loading state off /compare/[pair],
 * whose pages look nothing like the results list.
 */
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { isLocale } from '@/i18n/routing'

export default async function CompareResultsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)

  return (
    <>
      <SiteHeader locale={locale} active="compare" />
      {children}
      <SiteFooter locale={locale} />
    </>
  )
}
