import type { Metadata } from 'next'
import { fonts } from '@/lib/fonts'
import { THEME_SCRIPT } from '@/lib/theme'
import { InlineScript } from '@/components/inline-script'
import '../globals.css'

/** Alert links live outside /[locale], so they need their own document shell. */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
}

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    // THEME_SCRIPT sets data-theme before hydration, so React must not warn
    // about the attribute it did not render; same as the locale layout.
    <html lang="en-GB" dir="ltr" className={fonts} suppressHydrationWarning>
      <body>
        {/* First in <body> and blocking, so the saved theme applies before paint. */}
        <InlineScript html={THEME_SCRIPT} />
        {children}
      </body>
    </html>
  )
}
