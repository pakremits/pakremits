/**
 * Locale routing.
 *
 * Note we use next-intl for messages and formatting but *not* for its routing
 * middleware. Two reasons:
 *
 *  1. The middleware slot is already taken by the /admin basic-auth check in
 *     proxy.ts, and composing the two adds a failure mode for no benefit here.
 *  2. Our URLs are not a clean locale prefix anyway — the pretty corridor and
 *     rate URLs are already rewrites, so locale routing is expressed in the
 *     same next.config.ts rewrite table rather than in a second mechanism.
 *
 * English lives at the root (`/`, `/gbp-to-pkr`) and Urdu under `/ur`. The
 * `[locale]` segment is filled by the rewrites, so no locale detection or
 * redirect ever runs — a reader who lands on an English URL stays there.
 */
export const LOCALES = ['en', 'ur'] as const
export type Locale = (typeof LOCALES)[number]

/**
 * The locales the site actually publishes. Urdu is switched off for now: its
 * messages and page branches stay, but no Urdu page is built, linked, listed
 * in the sitemap or advertised through hreflang, and /ur/* redirects to the
 * English page (next.config.ts). To bring it back, add 'ur' here and restore
 * the Urdu rewrites in next.config.ts.
 */
export const ENABLED_LOCALES: readonly Locale[] = ['en']

export const DEFAULT_LOCALE: Locale = 'en'

/** Urdu is right-to-left; this drives the `dir` attribute on <html>. */
export const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ur: 'rtl',
}

/** BCP 47 tags for hreflang and Intl formatting. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: 'en-GB',
  ur: 'ur-PK',
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Narrow a route param to a Locale.
 *
 * Next types `params` as `{ locale: string }` — it cannot know our union — so
 * pages take a string and narrow here. The [locale] layout has already 404'd
 * anything invalid by the time a page runs, so the fallback is unreachable in
 * practice; it exists so this returns a Locale rather than throwing.
 */
export function toLocale(value: string): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Prefix a path for a locale. English is unprefixed, so this is the single
 * place that knows the URL shape — callers building hreflang or a language
 * switcher must go through it rather than concatenating `/ur` themselves.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return locale === DEFAULT_LOCALE ? clean : `/ur${clean === '/' ? '' : clean}`
}

/**
 * The `alternates` block for a page, so every page emits correct hreflang.
 * `x-default` points at English, which is the wider audience for these pages.
 */
export function alternatesFor(path: string) {
  const canonical = localePath(DEFAULT_LOCALE, path)
  // A single published language needs no hreflang: the canonical says it all.
  if (ENABLED_LOCALES.length < 2) return { canonical }
  return {
    canonical,
    languages: {
      ...Object.fromEntries(ENABLED_LOCALES.map((locale) => [LOCALE_TAG[locale], localePath(locale, path)])),
      'x-default': canonical,
    },
  }
}
