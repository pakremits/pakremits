import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MobileNav } from '@/components/mobile-nav'
import { ScrollTopLink } from '@/components/scroll-top-link'
import { ThemeToggle } from '@/components/theme-toggle'
import { type Locale, localePath } from '@/i18n/routing'
import { CORRIDORS } from '@/lib/corridors'
import { corridorPath, methodPath, ratePath, staticPath } from '@/lib/routes'

/**
 * Shared nav and footer. Both are server components — no client JS ships for
 * either — and both take the active locale so every link stays inside it.
 */

/** Line icons shown before each nav label. Decorative — the label carries the meaning. */
const NAV_ICONS = {
  compare: 'M20 7H9M20 12H11M20 17H9M8 4 4 7l4 3M8 14l-4 3 4 3',
  services: 'M12 3 3 7.5l9 4.5 9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  corridors: 'M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12a9 9 0 0 0 18 0 9 9 0 0 0-18 0z',
  howWeRank: 'M4 20h16M7 16v-5M12 16V6M17 16v-3',
  faq: 'M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
} as const

const BELL_ICON = 'M6 9a6 6 0 1 1 12 0c0 4.2 1.4 5.8 2 6.5H4c.6-.7 2-2.3 2-6.5zM10 19a2 2 0 0 0 4 0'

/** Icons for the home sections that only the phone menu links to. */
const DRAWER_ICONS = {
  example: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4M10 16h2',
  trust: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  whyUs: 'M12 4v16M8 20h8M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z',
  receive: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7V5.5A1.5 1.5 0 0 1 5.5 4H16M16 13.5h.01',
} as const

export type NavKey = keyof typeof NAV_ICONS
type DrawerKey = NavKey | keyof typeof DRAWER_ICONS

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
    // The services we compare, on the home page.
    { key: 'services', href: `${localePath(locale, '/')}#providers`, label: t('services') },
    { key: 'corridors', href: `${localePath(locale, '/')}#corridors`, label: t('corridors') },
    { key: 'howWeRank', href: staticPath('how-we-rank', locale), label: t('howWeRank') },
    { key: 'faq', href: `${localePath(locale, '/')}#faq`, label: t('faq') },
  ]

  // The phone menu has room for every home section, so it lists them in page
  // order with the bar's five links among them. The desktop bar stays at five.
  const home = localePath(locale, '/')
  const byKey = Object.fromEntries(nav.map((item) => [item.key, item]))
  const drawer: { key: DrawerKey; href: string; label: string }[] = [
    byKey.compare,
    { key: 'example', href: `${home}#example`, label: t('example') },
    { key: 'trust', href: `${home}#trust`, label: t('trust') },
    { key: 'whyUs', href: `${home}#how`, label: t('whyUs') },
    byKey.services,
    byKey.corridors,
    { key: 'receive', href: `${home}#receive`, label: t('receive') },
    byKey.howWeRank,
    byKey.faq,
  ]
  const drawerIcon = (key: DrawerKey) =>
    key in NAV_ICONS ? NAV_ICONS[key as NavKey] : DRAWER_ICONS[key as keyof typeof DRAWER_ICONS]

  const logo = (
    <>
      {/* The brand-sheet logo, teal and gold, in both themes: the teal still
          reads on the dark bar. See public/pakrimits-new-logo.svg.

          Plain <img>, not next/image: the source is a static SVG, which the
          image optimiser passes through untouched anyway and only serves
          behind `dangerouslyAllowSVG`. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pakrimits-new-logo.svg"
        alt="PakRemits"
        width={185}
        height={36}
        className="h-6 w-auto sm:h-9 lg:h-7 xl:h-9"
      />
    </>
  )

  const alertHref = `${localePath(locale, '/')}#alerts`

  return (
    /* Sticky and fully opaque, so the bar never reads as a tint of whatever
       scrolls beneath it. */
    <div className="sticky top-0 z-50 border-b border-line bg-header text-ink">
      <div className="mx-auto flex h-[86px] max-w-[1120px] items-center justify-between gap-4 px-6 lg:gap-6">
        <div className="flex min-w-0 items-center gap-5 xl:gap-6">
          <ScrollTopLink href={localePath(locale, '/')} className="flex shrink-0 items-center no-underline">
            {logo}
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
          {/* Opens the rate alert dialog. A bell alone on phones, where the
              label would crowd the logo; the drawer carries the full action. */}
          <Link
            href={alertHref}
            aria-label={t('rateAlert')}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-mist dark:bg-surface
                       text-[15px] font-semibold whitespace-nowrap text-ink no-underline
                       transition-shadow hover:shadow-[0_0_0_2px_var(--color-accent)]
                       sm:h-12 sm:w-auto sm:px-6"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 sm:hidden"
              aria-hidden="true"
            >
              <path d={BELL_ICON} />
            </svg>
            <span className="hidden sm:inline">{t('rateAlert')}</span>
          </Link>

          <MobileNav
            items={drawer.map((item) => ({
              href: item.href,
              label: item.label,
              icon: drawerIcon(item.key),
              current: item.key === active,
            }))}
            label={t('main')}
            openLabel={t('openMenu')}
            closeLabel={t('closeMenu')}
            brand={
              <Link href={localePath(locale, '/')} className="flex items-center no-underline">
                {logo}
              </Link>
            }
            cta={{ href: alertHref, label: t('setAlert') }}
            footer={
              <div className="flex items-center justify-between gap-4">
                <span className="text-[15px] text-muted">{t('appearance')}</span>
                <ThemeToggle toDarkLabel={t('themeDark')} toLightLabel={t('themeLight')} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}

/** Short names that fit a footer line; the rest use the corridor's own name. */
const FOOTER_COUNTRY: Record<string, string> = { uk: 'UK', uae: 'UAE', usa: 'USA' }

export async function SiteFooter({ locale = 'en' }: { locale?: Locale }) {
  const t = await getTranslations({ locale, namespace: 'footer' })

  /*
   * Every corridor, rate and payout page is linked from every page here, so
   * none of them depends on the home page alone for internal links.
   */
  const columns = [
    {
      heading: t('compare'),
      links: CORRIDORS.map((corridor) => ({
        href: corridorPath(corridor.slug, locale),
        label: `${FOOTER_COUNTRY[corridor.slug] ?? corridor.fromCountryName} to Pakistan`,
      })),
    },
    {
      heading: t('rates'),
      links: [
        ...CORRIDORS.map((corridor) => ({
          href: ratePath(corridor.fromCurrency, locale),
          label: `${corridor.fromCurrency} to PKR`,
        })),
        { href: `${localePath(locale, '/')}#alerts`, label: 'Rate alerts' },
      ],
    },
    {
      heading: t('receive'),
      links: [
        { href: methodPath('jazzcash', locale), label: 'JazzCash transfers' },
        { href: methodPath('easypaisa', locale), label: 'Easypaisa transfers' },
        { href: methodPath('rda', locale), label: 'Roshan Digital Account' },
      ],
    },
    {
      heading: t('brand'),
      links: [
        { href: staticPath('how-we-rank', locale), label: 'How we rank' },
        { href: staticPath('providers', locale), label: 'All providers' },
        { href: staticPath('about', locale), label: 'About PakRemits' },
        { href: staticPath('affiliate-disclosure', locale), label: 'Affiliate disclosure' },
        { href: staticPath('privacy', locale), label: 'Privacy' },
        { href: staticPath('contact', locale), label: 'Contact' },
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t border-line bg-footer px-0 pt-14 pb-10 text-ink">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href={localePath(locale, '/')} className="flex items-center no-underline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pakrimits-new-logo.svg"
                alt="PakRemits"
                width={185}
                height={36}
                className="h-9 w-auto"
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
