import type { Metadata } from 'next'
import { searchIndexingEnabled } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: searchIndexingEnabled() ? undefined : { index: false, follow: false },
  // Versioned so browsers drop a cached copy of the old icon; bump on change.
  icons: { icon: '/favicon.ico?v=4' },
}

/**
 * Root layout.
 *
 * Deliberately renders no <html> element. The locale determines both `lang` and
 * `dir`, and only the [locale] segment knows which locale it is, so that layout
 * owns the document shell. /admin has its own layout for the same reason.
 *
 * Next permits a root layout that passes children through when every branch
 * below it provides the document itself.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
