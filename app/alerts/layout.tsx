import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { fonts } from '@/lib/fonts'
import { THEME_SCRIPT } from '@/lib/theme'
import { InlineScript } from '@/components/inline-script'
import '../globals.css'

/**
 * The alert pages' document: no analytics, since the links that lead here
 * carry a capability token. Static, like the rest of the site.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
}

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  // The header and footer translate on the server; a static build has no
  // request to read the locale from.
  setRequestLocale(DEFAULT_LOCALE)
  return (
    // THEME_SCRIPT sets data-theme before hydration, so React must not warn
    // about the attribute it did not render; same as the site layout.
    <html lang="en-GB" dir="ltr" className={fonts} suppressHydrationWarning>
      <body>
        {/* First in <body> and blocking, so the saved theme applies before paint. */}
        <InlineScript html={THEME_SCRIPT} />
        {children}
      </body>
    </html>
  )
}
