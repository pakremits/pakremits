import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { type Locale, localePath } from '@/i18n/routing'
import { ProviderLogo } from '@/components/provider-logo'
import { REFRESH_MINUTES } from '@/lib/proof/config'
import { providerPath } from '@/lib/routes'

export interface RosterProvider {
  slug: string
  name: string
  brandColor: string
  brandTextColor: string
}

/**
 * Every service in the comparison, as one ruled table of marks.
 *
 * A table rather than a row of cards: the point is that the list is complete,
 * and a grid of equal cells reads as an inventory. The -mb-px/-me-px on the
 * list pushes the last row's and column's rules under the frame's overflow,
 * so an unfilled final row leaves blank cells instead of stray lines.
 */
export async function ProviderRoster({
  locale,
  providers,
}: {
  locale: Locale
  providers: RosterProvider[]
}) {
  if (providers.length === 0) return null
  const t = await getTranslations({ locale, namespace: 'home' })

  return (
    <section id="providers" aria-labelledby="providers-title" className="mt-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[54ch]">
          <h2
            id="providers-title"
            className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold"
          >
            {t('providersTitle')}
          </h2>
          <p className="mt-3 text-[17px] text-muted">
            {t('providersLede', { count: providers.length, minutes: REFRESH_MINUTES })}
          </p>
        </div>
        <Link
          href={localePath(locale, '/providers')}
          className="text-[15px] font-medium text-leaf underline underline-offset-4 hover:text-leaf-dark"
        >
          {t('providersAll')}
        </Link>
      </div>

      <div className="mt-7 overflow-hidden rounded-panel border border-line bg-surface">
        <ul className="-me-px -mb-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {providers.map((provider) => (
            <li key={provider.slug} className="border-e border-b border-line-2">
              <Link
                href={providerPath(provider.slug, locale)}
                className="flex h-full items-center gap-3 px-4 py-4 text-ink no-underline
                           transition-colors hover:bg-tint sm:px-5"
              >
                <ProviderLogo
                  providerSlug={provider.slug}
                  providerName={provider.name}
                  brandColor={provider.brandColor}
                  brandTextColor={provider.brandTextColor}
                  size="small"
                />
                <span className="min-w-0 text-[15px] leading-snug font-medium">{provider.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
