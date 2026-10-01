import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { corridorPath } from '@/lib/routes'
import { CountryFlag } from '@/components/select-icons'

export interface MarqueeItem {
  slug: string
  countryCode: string
  countryName: string
  currency: string
  /** Best provider rate on the corridor right now, or null with no quotes. */
  bestRate: number | null
  /** Seven-day mid-market move, the same figure the hero ticker shows. */
  changePercent: number | null
}

/**
 * The corridor marquee: best rate per sending country, scrolling.
 *
 * Full-bleed by design — it breaks the 1120px column on purpose, which is the
 * whole reason it reads as a ticker rather than another card. The duplicate set
 * is what makes the loop seamless (the track animates to -50%), so the two
 * halves must stay identical; the copy is hidden from assistive tech and taken
 * out of the tab order rather than announcing every corridor twice.
 */
export async function RateMarquee({
  locale,
  items,
}: {
  locale: Locale
  items: MarqueeItem[]
}) {
  const t = await getTranslations({ locale, namespace: 'home' })

  if (items.length === 0) return null

  const row = (item: MarqueeItem, { duplicate }: { duplicate: boolean }) => {
    // Under 0.05% the label rounds to "0.0%", so an arrow beside it would claim
    // a move the number denies. Same threshold as the hero ticker.
    const trend =
      item.changePercent === null || Math.abs(item.changePercent) < 0.05
        ? 'flat'
        : item.changePercent > 0
          ? 'up'
          : 'down'

    return (
      <Link
        key={`${duplicate ? 'dup-' : ''}${item.slug}`}
        href={corridorPath(item.slug, locale)}
        tabIndex={duplicate ? -1 : undefined}
        className="group/mq flex items-center gap-2.5 px-4 py-3.5 whitespace-nowrap text-ink
                   no-underline transition-colors sm:gap-3.5 sm:px-7 sm:py-6 hover:text-tint-ink"
      >
        <span className="flex h-7 w-8 flex-none items-center justify-center rounded-[7px] bg-line-2 sm:h-8.5 sm:w-10 sm:rounded-[8px] [&_svg]:max-sm:h-3.5 [&_svg]:max-sm:w-5">
          <CountryFlag countryCode={item.countryCode} />
        </span>

        <span className="text-[13px] leading-[1.2] font-medium sm:text-[15px]">
          {item.countryName}
          <small className="mt-0.5 block text-[11px] leading-[1.2] font-normal text-faint sm:text-[12px]">
            → PKR
          </small>
        </span>

        <span className="money ml-1 font-display text-[17px] font-semibold tracking-[-0.02em] tabular-nums sm:ml-2 sm:text-xl">
          {item.bestRate?.toFixed(2) ?? '—'}
        </span>

        {item.changePercent !== null && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] sm:px-1.75 sm:text-[12px] ${
              trend === 'up'
                ? 'bg-icon-bg text-ok'
                : trend === 'down'
                  ? 'bg-danger-bg text-danger'
                  : 'bg-line-2 text-muted'
            }`}
            aria-label={
              trend === 'flat'
                ? t('flatThisWeek')
                : t('changeThisWeek', {
                    direction: trend === 'down' ? '▼' : '▲',
                    percent: Math.abs(item.changePercent).toFixed(1),
                  })
            }
          >
            <span aria-hidden="true">
              {trend === 'flat'
                ? t('marqueeFlat')
                : `${trend === 'down' ? '▼' : '▲'} ${Math.abs(item.changePercent).toFixed(1)}%`}
            </span>
          </span>
        )}

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="hidden h-4 w-4 -translate-x-1 text-faint opacity-0 transition-all sm:block
                     group-hover/mq:translate-x-0 group-hover/mq:text-tint-ink group-hover/mq:opacity-100"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    )
  }

  return (
    <section
      className="relative mt-10 ms-[calc(50%-50vw)] w-screen"
      aria-label={t('marqueeLabel')}
    >
      <div
        className="mx-auto mb-3 flex max-w-[1120px] items-baseline justify-between gap-4
                   px-6 text-[12px] text-muted sm:mb-3.5 sm:text-[13px]"
      >
        <span>
          {t.rich('marqueeHead', {
            strong: (chunks) => <b className="font-medium text-ink">{chunks}</b>,
          })}
        </span>
        <span className="hidden sm:inline">{t('marqueeHint')}</span>
      </div>

      <div className="marquee-viewport relative overflow-hidden bg-surface">
        <div className="marquee-track flex w-max">
          {items.map((item) => row(item, { duplicate: false }))}
          <span className="marquee-dup contents" aria-hidden="true">
            {items.map((item) => row(item, { duplicate: true }))}
          </span>
        </div>
      </div>
    </section>
  )
}
