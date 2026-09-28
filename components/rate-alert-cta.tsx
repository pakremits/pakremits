import Link from 'next/link'
import type { ReactNode } from 'react'
import { type Locale, localePath } from '@/i18n/routing'

/**
 * "Tell me when the rate hits my target" banner.
 *
 * A server component with no behaviour of its own: the button is an ordinary
 * #alerts link, which the RateAlertDialog mounted in the layout intercepts and
 * opens. Deliberately no `id="alerts"` here — that would also make the browser
 * scroll to the banner behind the dialog. Colours come from the theme tokens,
 * so the same markup serves light and dark.
 */
export function RateAlertCta({
  locale,
  title,
  body,
  button,
  className = '',
  aside,
}: {
  locale: Locale
  title: string
  body: string
  button: string
  className?: string
  /** Shown beside the copy on wide screens, e.g. the rate chart. */
  aside?: ReactNode
}) {
  return (
    <section
      aria-labelledby="rate-alert-cta-title"
      className={`rounded-[20px] bg-surface px-6 py-7 sm:px-10 sm:py-9 ${
        aside
          ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-12'
          : 'flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10'
      } ${className}`}
    >
      <div className={aside ? 'flex flex-col items-start gap-7' : 'contents'}>
        <div className="max-w-[60ch]">
          <h2
            id="rate-alert-cta-title"
            className="text-[24px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[28px]"
          >
            {title}
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-muted sm:text-[17px]">{body}</p>
        </div>

        <Link
          href={`${localePath(locale, '/')}#alerts`}
          className="flex h-[58px] w-full shrink-0 items-center justify-center rounded-[8px] bg-gold px-12 sm:w-auto
                     text-[19px] font-bold whitespace-nowrap text-on-gold no-underline
                     shadow-[0_10px_30px_-8px_rgba(224,165,19,.55)] transition-colors
                     hover:bg-gold-hover lg:w-auto"
        >
          {button}
        </Link>
      </div>

      {aside}
    </section>
  )
}
