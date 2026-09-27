import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MobileNav } from '@/components/mobile-nav'
import { ScrollTopLink } from '@/components/scroll-top-link'
import { ThemeToggle } from '@/components/theme-toggle'
import { type Locale, localePath } from '@/i18n/routing'
import { corridorPath, methodPath, ratePath, staticPath } from '@/lib/routes'

/**
 * Shared nav and footer. Both are server components — no client JS ships for
 * either — and both take the active locale so every link stays inside it.
 */

/** Line icons shown before each nav label. Decorative — the label carries the meaning. */
const NAV_ICONS = {
  compare: 'M20 7H9M20 12H11M20 17H9M8 4 4 7l4 3M8 14l-4 3 4 3',
  alerts: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  corridors: 'M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12a9 9 0 0 0 18 0 9 9 0 0 0-18 0z',
  howWeRank: 'M4 20h16M7 16v-5M12 16V6M17 16v-3',
  faq: 'M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
} as const

export type NavKey = keyof typeof NAV_ICONS

export async function SiteHeader({
  locale = 'en',
  active,
}: {
  locale?: Locale
  /** Highlights one nav item, e.g. `compare` on the results page. */
  active?: NavKey
}) {
  const t = await getTranslations({ locale, namespace: 'nav' })

  const nav: { key: NavKey; href: string; label: string }[] = [
    {
      key: 'compare',
      // On /compare the item is the current page, so it scrolls back up there.
      href: active === 'compare' ? localePath(locale, '/compare') : `${localePath(locale, '/')}#compare`,
      label: t('compare'),
    },
    { key: 'alerts', href: `${localePath(locale, '/')}#alerts`, label: t('alerts') },
    { key: 'corridors', href: `${localePath(locale, '/')}#corridors`, label: t('corridors') },
    { key: 'howWeRank', href: staticPath('how-we-rank', locale), label: t('howWeRank') },
    { key: 'faq', href: `${localePath(locale, '/')}#faq`, label: t('faq') },
  ]

  return (
    /* Sticky and fully opaque, so the bar never reads as a tint of whatever
       scrolls beneath it. */
    <div className="sticky top-0 z-50 border-b border-line bg-header text-ink">
      <div className="mx-auto flex h-[86px] max-w-[1120px] items-center justify-between gap-4 px-6 lg:gap-6">
        <div className="flex min-w-0 items-center gap-5 xl:gap-6">
          <ScrollTopLink href={localePath(locale, '/')} className="flex shrink-0 items-center no-underline">
            {/* The brand-sheet logo, teal and gold for a white bar. See public/pakrimits-new-logo.svg.

                Plain <img>, not next/image: the source is a static SVG, which the
                image optimiser passes through untouched anyway and only serves
                behind `dangerouslyAllowSVG`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pakrimits-new-logo.svg"
              alt="PakRemits"
              width={185}
              height={36}
              className="h-6 w-auto sm:h-9 lg:h-7 xl:h-9 dark:hidden"
            />
            {/* Dark theme: same mark, light wordmark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pakrimits-new-logo-dark.svg"
              alt="PakRemits"
              width={185}
              height={36}
              className="hidden h-6 w-auto sm:h-9 lg:h-7 xl:h-9 dark:block"
            />
          </ScrollTopLink>

          {/* Hidden on the landmark, not the list: leaving an empty <nav> with
              this label in the mobile DOM would give the page two "Main"
              navigation landmarks, one of them empty. */}
          <nav aria-label={t('main')} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <ScrollTopLink
                    href={item.href}
                    aria-current={item.key === active ? 'page' : undefined}
                    className={`flex items-center gap-1.5 rounded-[10px] px-2 py-2.5 text-[15px] whitespace-nowrap xl:px-3 xl:text-[16px]
                                font-medium no-underline transition-colors ${
                                  item.key === active
                                    ? 'bg-nav-tint text-green'
                                    : 'text-ink-2 hover:bg-tint hover:text-tint-ink'
                                }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 shrink-0"
                      aria-hidden="true"
                    >
                      <path d={NAV_ICONS[item.key]} />
                    </svg>
                    {item.label}
                  </ScrollTopLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* No room in the phone bar; there it sits in the menu instead. */}
          <ThemeToggle
            toDarkLabel={t('themeDark')}
            toLightLabel={t('themeLight')}
            className="hidden sm:grid"
          />
          {/* Dropped below 360px, where it would run over the logo; "Rate
              alerts" in the menu reaches the same dialog. */}
          <Link
            href={`${localePath(locale, '/')}#alerts`}
            className="flex h-12 items-center rounded-[10px] border border-line bg-surface px-3.5 max-[359px]:hidden
                       text-[14px] font-semibold sm:text-[15px] whitespace-nowrap text-ink no-underline
                       transition-[border-color,box-shadow] hover:border-accent hover:shadow-[0_0_0_2px_var(--color-accent)] sm:px-6"
          >
            {t('setAlert')}
          </Link>

          <MobileNav
            items={nav}
            label={t('main')}
            openLabel={t('openMenu')}
            closeLabel={t('closeMenu')}
            footer={
              <ThemeToggle toDarkLabel={t('themeDark')} toLightLabel={t('themeLight')} />
            }
          />
        </div>
      </div>
    </div>
  )
}

export async function SiteFooter({ locale = 'en' }: { locale?: Locale }) {
  const t = await getTranslations({ locale, namespace: 'footer' })

  const columns = [
    {
      heading: t('compare'),
      links: [
        { href: corridorPath('uk', locale), label: 'UK to Pakistan' },
        { href: corridorPath('uae', locale), label: 'UAE to Pakistan' },
        { href: corridorPath('saudi-arabia', locale), label: 'Saudi Arabia to Pakistan' },
        { href: corridorPath('usa', locale), label: 'USA to Pakistan' },
        { href: methodPath('jazzcash', locale), label: 'Send to JazzCash' },
      ],
    },
    {
      heading: t('rates'),
      links: [
        { href: ratePath('gbp', locale), label: 'GBP to PKR' },
        { href: ratePath('aed', locale), label: 'AED to PKR' },
        { href: ratePath('sar', locale), label: 'SAR to PKR' },
        { href: ratePath('usd', locale), label: 'USD to PKR' },
        { href: `${localePath(locale, '/')}#alerts`, label: 'Rate alerts' },
      ],
    },
    {
      heading: t('brand'),
      links: [
        { href: staticPath('how-we-rank', locale), label: 'How we rank' },
        { href: staticPath('providers', locale), label: 'All providers' },
        { href: staticPath('affiliate-disclosure', locale), label: 'Affiliate disclosure' },
        { href: staticPath('privacy', locale), label: 'Privacy' },
        { href: staticPath('contact', locale), label: 'Contact' },
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t border-line bg-footer px-0 pt-14 pb-10 text-ink">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href={localePath(locale, '/')} className="flex items-center no-underline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pakrimits-new-logo.svg"
                alt="PakRemits"
                width={185}
                height={36}
                className="h-9 w-auto dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pakrimits-new-logo-dark.svg"
                alt="PakRemits"
                width={185}
                height={36}
                className="hidden h-9 w-auto dark:block"
              />
            </Link>
            {/* Affiliate disclosure. Required on every page carrying provider
                links, so it lives in the footer rather than on one page. */}
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-muted">{t('disclosure')}</p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3.5 text-[13px] font-semibold text-ink">{column.heading}</h2>
              <ul className="grid gap-2.5 text-[14.5px]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-ink-2 no-underline hover:text-green">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-10 border-t border-line pt-5 text-[12.5px] text-muted"
        >
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  )
}
