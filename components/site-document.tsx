import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { GoogleTagManager } from '@next/third-parties/google'
import { fonts } from '@/lib/fonts'
import { DEFAULT_LOCALE, LOCALE_DIR, LOCALE_TAG } from '@/i18n/routing'
import { getMessages } from '@/i18n/messages'
import { NavigationScrollReset } from '@/components/navigation-scroll-reset'
import { RateAlertDialog } from '@/components/rate-alert-dialog'
import { ScrollReveal } from '@/components/scroll-reveal'
import { THEME_SCRIPT } from '@/lib/theme'
import { InlineScript } from '@/components/inline-script'
import { CORRIDORS } from '@/lib/corridors'
import { latestMidMarket } from '@/lib/quotes'
import '@/app/globals.css'

/**
 * The public site's document: <html>, theme, analytics, messages and the
 * rate alert dialog. The (site) layout wraps every page in it, and the 404
 * page, which renders outside that layout, uses it too.
 *
 * Every page is built ahead of time as a static file (`output: 'export'`), so
 * nothing here may read the request.
 *
 * English only for now: Urdu is switched off (ENABLED_LOCALES in
 * i18n/routing.ts) and its messages stay in the repository. Bringing it back
 * means a /ur tree of pages, since a static site has no rewrites to map one.
 */
export async function SiteDocument({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE

  // Without it, next-intl's server APIs read the locale from request headers,
  // which a static build does not have.
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
    // The /compare results page renders in the browser.
    compare: all.compare,
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
