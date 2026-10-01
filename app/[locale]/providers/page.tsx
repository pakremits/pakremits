import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { ProviderLogo } from '@/components/provider-logo'
import { isLocale } from '@/i18n/routing'
import { db } from '@/lib/db'
import { providers } from '@/lib/db/schema'
import { publicPageMetadata } from '@/lib/seo'

export const revalidate = 3600

export const metadata: Metadata = publicPageMetadata({
  title: 'Money transfer providers to Pakistan | PakRemits',
  description: 'Explore providers that send money to Pakistan. Compare available rates and see which support bank deposits, cash pickup and Pakistani mobile wallets.',
  path: '/providers',
})

const RAILS = [
  { key: 'supportsBank', label: 'Bank account' },
  { key: 'supportsWallet', label: 'JazzCash / Easypaisa' },
  { key: 'supportsNeobank', label: 'Sadapay / Nayapay' },
  { key: 'supportsCash', label: 'Cash pickup' },
  { key: 'supportsRda', label: 'Roshan Digital Account' },
] as const

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isLocale(localeParam) ? localeParam : notFound()
  setRequestLocale(locale)

  // Degrade rather than 500 if the database is unreachable — the rest of the
  // page (the explanation of what we do and do not list) is still worth serving.
  let rows: (typeof providers.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(providers)
      .where(eq(providers.active, true))
      .orderBy(providers.name)
  } catch (error) {
    // The lazy DB proxy can throw while constructing the query (for example,
    // when DATABASE_URL is absent at build time), before a promise exists for
    // a chained .catch() to observe.
    console.error('[providers] list failed:', error)
  }

  const real = rows.filter((row) => !row.isBenchmark)

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="no-underline hover:text-leaf">
                PakRemits
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">Providers</li>
          </ol>
        </nav>

        <h1 className="mt-5 text-[clamp(34px,4.6vw,52px)] leading-[1.05] font-semibold">
          Money transfer providers we track
        </h1>
        <p className="mt-4 max-w-[62ch] text-[17px] text-muted">
          We show verified services that send money to Pakistan. A provider enters the live ranking
          only where we can fetch a genuine rate and fee without working around its site —{' '}
          <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
            how we rank
          </Link>{' '}
          explains which and why.
        </p>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {real.map((provider, index) => (
            <Link
              key={provider.slug}
              href={`/providers/${provider.slug}`}
              style={{ '--i': index % 3 } as React.CSSProperties}
              className="card-rise card-lift rounded-panel border border-line bg-surface p-6 no-underline
                         transition-[border-color] hover:border-leaf"
            >
              <div className="flex items-center gap-3.5">
                <ProviderLogo
                  providerSlug={provider.slug}
                  providerName={provider.name}
                  brandColor={provider.brandColor}
                  brandTextColor={provider.brandTextColor}
                />
                <span className="text-[17px] font-medium text-ink">{provider.name}</span>
              </div>

              <ul className="mt-4 grid gap-1.5 text-[13.5px] text-muted">
                {RAILS.filter((rail) => provider[rail.key]).map((rail) => (
                  <li key={rail.key} className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-3 w-3 flex-none text-leaf"
                      aria-hidden="true"
                    >
                      <path d="M4 12l6 6L20 6" />
                    </svg>
                    {rail.label}
                  </li>
                ))}
              </ul>

              {provider.commissionNote && (
                <p className="mt-4 border-t border-line-2 pt-3 text-xs text-faint">
                  {provider.commissionNote}
                </p>
              )}
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter locale={locale} />
    </>
  )
}
