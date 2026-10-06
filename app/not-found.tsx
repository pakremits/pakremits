import '@/lib/db/static-build'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteDocument } from '@/components/site-document'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { CORRIDORS } from '@/lib/corridors'
import { corridorPath } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Page not found | PakRemits',
  robots: { index: false, follow: true },
}

/**
 * The 404 page, built as /404.html, which Cloudflare serves for any URL with
 * no file behind it. It renders outside the (site) layout, so it brings the
 * site's document itself.
 */
export default function NotFound() {
  const locale = DEFAULT_LOCALE

  return (
    <SiteDocument>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-[1120px] px-6 py-20">
        <p className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">404</p>
        <h1 className="mt-3 text-[clamp(32px,4.4vw,48px)] leading-[1.05] font-semibold">
          This page does not exist
        </h1>
        <p className="mt-4 max-w-[56ch] text-[17px] text-muted">
          The link may be old or mistyped. Every comparison starts from the home page, or go
          straight to the country you are sending from.
        </p>
        <ul className="mt-8 flex flex-wrap gap-3 text-[15px]">
          <li>
            <Link
              href="/"
              className="inline-flex rounded-full bg-green px-5 py-2.5 font-medium text-white no-underline"
            >
              Compare rates
            </Link>
          </li>
          {CORRIDORS.map((corridor) => (
            <li key={corridor.slug}>
              <Link
                href={corridorPath(corridor.slug)}
                className="inline-flex rounded-full bg-surface px-4 py-2.5 text-ink no-underline ring-1 ring-line hover:text-leaf"
              >
                {corridor.fromCountryName}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter locale={locale} />
    </SiteDocument>
  )
}
