import '@/lib/db/static-build'
import type { Metadata } from 'next'
import { SiteDocument } from '@/components/site-document'

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

/** Every public page, built ahead of time as a static file. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>
}
