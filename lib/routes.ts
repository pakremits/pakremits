/**
 * Public URL builders.
 *
 * Every internal link goes through here. The internal paths (/corridor/[slug],
 * /rate/[currency], /method/[slug]) are implementation details behind rewrites
 * and must never be linked directly — robots.txt disallows them, so a stray
 * internal link would point search engines at a de-indexed URL.
 *
 * All builders take a locale so Urdu pages link to Urdu pages.
 */
import { type Locale, localePath } from '@/i18n/routing'

/*
 * Every comparison page lives under /compare: corridors, payout rails and the
 * provider head-to-heads. PakRemits compares; it does not send money, so the
 * URLs say "compare" rather than "send money". The old /send-money-… URLs
 * 301 here (next.config.ts).
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
