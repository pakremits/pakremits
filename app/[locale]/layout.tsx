import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { GoogleTagManager } from '@next/third-parties/google'
import { fonts } from '@/lib/fonts'
import { ENABLED_LOCALES, LOCALE_DIR, LOCALE_TAG, isLocale } from '@/i18n/routing'
import { getMessages } from '@/i18n/messages'
import { NavigationScrollReset } from '@/components/navigation-scroll-reset'
import { RateAlertDialog } from '@/components/rate-alert-dialog'
import { ScrollReveal } from '@/components/scroll-reveal'
import { THEME_SCRIPT } from '@/lib/theme'
import { InlineScript } from '@/components/inline-script'
import { CORRIDORS } from '@/lib/corridors'
import { latestMidMarket } from '@/lib/quotes'
import '../globals.css'

export const metadata: Metadata = {
  /**
   * Without this, Next emits `<link rel="canonical" href="/">` and relative
   * hreflang hrefs. Lighthouse flags both — search engines want absolute URLs,
   * and a relative hreflang is simply ignored, which silently undoes the whole
   * bilingual setup.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'PakRemits — compare rates before you send money to Pakistan',
  description:
    'Compare every major service sending money to Pakistan, ranked by the exact amount that ' +
    'lands in the account. Not by rate, not by fee, not by who pays us.',
}

// The alert dialog shows live mid-market rates on every page, so no page under
// this layout may cache them for longer than the 15-minute refresh.
export const revalidate = 900

export function generateStaticParams() {
  return ENABLED_LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate before narrowing, not after. An unknown locale segment must 404
  // rather than falling back to English — otherwise /anything would serve the
  // home page and the site would sprout infinite duplicate URLs.
  if (!isLocale(locale)) notFound()

  // Required for static rendering. Without it, next-intl's server APIs read
  // from headers and silently opt every page into dynamic rendering — the
  // whole route tree drops from prerendered to server-rendered-on-demand.
  setRequestLocale(locale)

  const all = await getMessages(locale)

  // Rate alert dialog data. latestMidMarket degrades to null on a database
  // outage, so the dialog still opens with the pairs listed.
  const alertPairs = await Promise.all(
    CORRIDORS.map(async (corridor) => ({
      currency: corridor.fromCurrency,
      countryCode: corridor.fromCountry,
      rate: await latestMidMarket(corridor.fromCurrency),
    })),
  )
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    // Cloudflare's always-pass test key, so alerts work in development.
    (process.env.NODE_ENV !== 'production' ? '1x00000000000000000000AA' : '')

  /**
   * Only the namespaces client components actually read.
   *
   * NextIntlClientProvider serialises whatever it is given into the RSC payload
   * on every page, so passing the whole catalogue shipped `home`, `footer`,
   * `nav` and `common` — all rendered on the server — to the browser as dead
   * weight. Measured at 4.6kB of the 7.2kB catalogue.
   *
   * If a new client component needs a namespace, add it here; `useTranslations`
   * will throw a clear error naming the missing one rather than rendering the
   * key.
   */
  const messages = {
    panel: all.panel,
    methods: all.methods,
    alerts: all.alerts,
  }

  // The same public layout serves every comparison and information page. Keep
  // GTM out of the separate admin and alert-management document layouts.
  const configuredGtmId = process.env.NEXT_PUBLIC_GTM_ID
  const gtmId = configuredGtmId && /^GTM-[A-Z0-9]+$/.test(configuredGtmId)
    ? configuredGtmId
    : undefined

  return (
    <html
      lang={LOCALE_TAG[locale]}
      dir={LOCALE_DIR[locale]}
      className={fonts}
      // Urdu needs the larger line-height Nastaliq requires; setting it here
      // rather than per-component keeps it out of every layout calculation.
      data-locale={locale}
      // THEME_SCRIPT sets data-theme before hydration, so React must not
      // treat the extra attribute as a mismatch.
      suppressHydrationWarning
    >
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body>
        {/* First in <body> and blocking on purpose: it must set the theme
            before anything paints. */}
        <InlineScript html={THEME_SCRIPT} />
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <RateAlertDialog pairs={alertPairs} turnstileSiteKey={turnstileSiteKey} />
          <ScrollReveal />
          {/* Suspense: reading the query string must not opt pages out of static rendering. */}
          <Suspense fallback={null}>
            <NavigationScrollReset />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
