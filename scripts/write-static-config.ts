/**
 * Finishes the static build: writes out/_headers and out/_redirects, then
 * checks the pages and data files every deploy needs are there.
 *
 * A static export cannot carry next.config.ts headers or redirects, so those
 * rules are generated here, from the same route helpers the pages link with,
 * and Cloudflare applies them to the static assets. Responses the Worker
 * makes itself (/api, /go, /alerts, /admin) set their own headers.
 *
 *   npm run build   # next build, then this
 */
import '../lib/load-env'
import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { CORRIDORS } from '../lib/corridors'
import { METHOD_CONTENT } from '../lib/content/methods'
import { SEND_CURRENCIES } from '../lib/db/schema'
import { corridorPath, methodPath, ratePath } from '../lib/routes'
import { searchIndexingEnabled } from '../lib/seo'

const OUT = 'out'

/**
 * Content-Security-Policy, in two parts.
 *
 * Enforced: the directives that cannot break a page. No plugins, no <base>
 * hijack, no framing (as X-Frame-Options), forms post only to this site.
 *
 * Report-only: the full allow-list for scripts, styles, connections and
 * frames (Google Tag Manager and Analytics, Cloudflare Turnstile). Browsers
 * log what it would block without blocking it. Check the console against the
 * live GTM container, which can load tags this list does not know about, then
 * move it into the enforced header. Inline scripts stay allowed: the static
 * pages carry their data in inline scripts, and hashing those per build is
 * not worth it for a report-only policy.
 */
const CSP_ENFORCED = [
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com https://www.googletagmanager.com',
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

const WEEK_CACHE = 'public, max-age=604800, stale-while-revalidate=86400'

function rule(path: string, headers: string[]): string {
  return [path, ...headers.map((header) => `  ${header}`)].join('\n')
}

const headers = [
  rule('/*', [
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy: camera=(), geolocation=(), microphone=()',
    'Strict-Transport-Security: max-age=63072000; includeSubDomains',
    `Content-Security-Policy: ${CSP_ENFORCED}`,
    `Content-Security-Policy-Report-Only: ${CSP_REPORT_ONLY}`,
    /**
     * Staging and previews: noindex on every response, HTML or not.
     * robots.txt deliberately still allows crawling, so this is seen.
     */
    ...(searchIndexingEnabled() ? [] : ['X-Robots-Tag: noindex, nofollow']),
  ]),
  // Hashed file names: a new build never reuses one.
  rule('/_next/static/*', ['Cache-Control: public, max-age=31536000, immutable']),
  rule('/provider-logos/*', [`Cache-Control: ${WEEK_CACHE}`]),
  rule('/payout-icons/*', [`Cache-Control: ${WEEK_CACHE}`]),
  // Rebuilt after every refresh at the same names: always revalidate.
  rule('/data/*', ['Cache-Control: no-cache']),
  /**
   * Alert pages carry a capability token in the URL. The site-wide policy
   * sends the full URL as the referrer on same-origin navigations, and the
   * next page loads analytics, which records it: the token would end up in
   * analytics. `!` drops the site-wide value rather than adding a second one.
   */
  rule('/alerts/*', ['! Referrer-Policy', 'Referrer-Policy: no-referrer']),
]

function redirect(from: string, to: string, status: 301 | 302): string {
  return `${from} ${to} ${status}`
}

const redirects = [
  /**
   * Urdu is switched off for now (ENABLED_LOCALES in i18n/routing.ts). Every
   * /ur URL goes to the same page in English. Temporary, not permanent: Urdu
   * is coming back, and a cached permanent redirect would keep readers away
   * from it after it does.
   */
  redirect('/ur', '/', 302),
  redirect('/ur/*', '/:splat', 302),
  // English used to be reachable under /en as well as at the root.
  redirect('/en', '/', 301),
  redirect('/en/*', '/:splat', 301),

  /**
   * The comparison pages moved from /send-money-… to /compare/… (PakRemits
   * compares services; it does not send money). Permanent, so search engines
   * move each page's ranking to its new address. Listed one by one: a
   * placeholder must be a whole path segment.
   */
  ...CORRIDORS.map((corridor) =>
    redirect(`/send-money-from-${corridor.slug}-to-pakistan`, corridorPath(corridor.slug), 301),
  ),
  redirect('/roshan-digital-account-transfer', methodPath('rda'), 301),
  ...METHOD_CONTENT.map((entry) => redirect(`/send-money-to-${entry.slug}`, methodPath(entry.slug), 301)),

  // The old internal paths behind the rewrites occasionally escape through
  // copied URLs; send them to their public equivalents.
  ...CORRIDORS.map((corridor) =>
    redirect(`/corridor/${corridor.slug}`, corridorPath(corridor.slug), 301),
  ),
  ...SEND_CURRENCIES.map((currency) =>
    redirect(`/rate/${currency.toLowerCase()}`, ratePath(currency), 301),
  ),
  ...METHOD_CONTENT.map((entry) => redirect(`/method/${entry.slug}`, methodPath(entry.slug), 301)),
]

/** Files every deploy must have; a build missing one is not deployable. */
const required = [
  'index.html',
  '404.html',
  'compare.html',
  'providers.html',
  'how-we-rank.html',
  'sitemap.xml',
  'robots.txt',
  ...CORRIDORS.flatMap((corridor) => [
    `${corridorPath(corridor.slug).slice(1)}.html`,
    `data/quotes/${corridor.slug}.json`,
    `og/corridor/${corridor.slug}.png`,
  ]),
  ...SEND_CURRENCIES.map((currency) => `${ratePath(currency).slice(1)}.html`),
  ...METHOD_CONTENT.map((entry) => `${methodPath(entry.slug).slice(1)}.html`),
]

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

/**
 * The client router prefetches each page segment from a file such as
 * `__next.!KHNpdGUp.__PAGE__.txt`. On Windows, Next's export builds that name
 * from a path with backslashes, which become folders
 * (`__next.!KHNpdGUp/__PAGE__.txt`), and the prefetches 404. Builds on Linux,
 * the ones that deploy, are unaffected and have no such folders; this puts a
 * local build's files where the router looks for them.
 */
function flattenSegmentFiles(dir: string): number {
  let moved = 0
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (!statSync(path).isDirectory()) continue
    if (!name.startsWith('__next.')) {
      moved += flattenSegmentFiles(path)
      continue
    }
    for (const file of filesUnder(path)) {
      const flat = `${name}.${relative(path, file).split(sep).join('.')}`
      renameSync(file, join(dir, flat))
      moved += 1
    }
    rmSync(path, { recursive: true })
  }
  return moved
}

function main() {
  if (!existsSync(OUT)) throw new Error(`${OUT}/ does not exist: run next build first`)

  const flattened = flattenSegmentFiles(OUT)
  if (flattened > 0) console.log(`Moved ${flattened} prefetch segment files out of folders (a Windows build).`)

  const missing = required.filter((file) => !existsSync(join(OUT, file)))
  if (missing.length > 0) {
    throw new Error(`The build is missing ${missing.length} file(s):\n  ${missing.join('\n  ')}`)
  }

  writeFileSync(join(OUT, '_headers'), `${headers.join('\n\n')}\n`)
  writeFileSync(join(OUT, '_redirects'), `${redirects.join('\n')}\n`)
  console.log(
    `Wrote ${OUT}/_headers (${headers.length} rules, indexing ${searchIndexingEnabled() ? 'on' : 'off'}) ` +
      `and ${OUT}/_redirects (${redirects.length} rules); ${required.length} required files present.`,
  )
}

main()
