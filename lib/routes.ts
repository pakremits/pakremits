/**
 * Public URL builders.
 *
 * Every internal link goes through here. Each URL is a file in the static
 * build, so a hand-written path that drifts from these builders is a 404. The
 * old internal paths (/corridor/…, /rate/…, /method/…) only redirect now.
 *
 * All builders take a locale so Urdu pages link to Urdu pages.
 */
import { type Locale, localePath } from '@/i18n/routing'

/*
 * Every comparison page lives under /compare: corridors, payout rails and the
 * provider head-to-heads. PakRemits compares; it does not send money, so the
 * URLs say "compare" rather than "send money". The old /send-money-… URLs
 * 301 here (out/_redirects, written by scripts/write-static-config.ts).
 */
export function corridorPath(slug: string, locale: Locale = 'en'): string {
  return localePath(locale, `/compare/${slug}-to-pakistan`)
}

export function ratePath(currency: string, locale: Locale = 'en'): string {
  return localePath(locale, `/${currency.toLowerCase()}-to-pkr`)
}

export function methodPath(slug: string, locale: Locale = 'en'): string {
  // "rda" is spelled out: it is the phrase people search for.
  const path =
    slug === 'rda' ? '/compare/roshan-digital-account-transfers' : `/compare/${slug}-transfers`
  return localePath(locale, path)
}

export function providerPath(slug: string, locale: Locale = 'en'): string {
  return localePath(locale, `/providers/${slug}`)
}

export function comparePath(a: string, b: string, locale: Locale = 'en'): string {
  // Canonical order only — the reverse form 404s so two of our own pages never
  // compete for the same query.
  const [first, second] = [a, b].sort()
  return localePath(locale, `/compare/${first}-vs-${second}`)
}

export function homePath(locale: Locale = 'en'): string {
  return localePath(locale, '/')
}

export function staticPath(page: string, locale: Locale = 'en'): string {
  return localePath(locale, `/${page}`)
}
