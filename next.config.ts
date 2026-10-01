import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

// Points next-intl at i18n/request.ts. Required even though we handle locale
// routing ourselves through the rewrite table below.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * URL mapping.
 *
 * Two things are happening here, both of which exist because the URLs we want
 * to publish do not match the shape Next's file router can express.
 *
 * 1. **Pretty URLs.** Next dynamic segments must be a whole path segment, so
 *    `compare/[slug]-to-pakistan` is not expressible as a folder. The
 *    pages live at `/corridor/[slug]`, `/rate/[currency]` and `/method/[slug]`,
 *    and these rewrites expose the public form. robots.txt disallows the
 *    internal forms so the two never compete for the same ranking signal.
 *
 * 2. **An unprefixed default locale.** Pages live under `/[locale]`, but
 *    English must be served from the root — `/gbp-to-pkr`, not `/en/gbp-to-pkr`.
 *
 * Everything is in `beforeFiles` and every English path is listed explicitly.
 * A catch-all `/:path*` → `/en/:path*` would be shorter but wrong: it runs
 * after route matching, and `/how-we-rank` already matches `/[locale]` with
 * locale="how-we-rank", so it would never reach the rewrite. Listing the paths
 * is verbose and obvious, which beats short and subtly broken.
 *
 * Adding a page therefore means adding a line here. That is the cost of clean
 * URLs plus an unprefixed default locale, and it is worth it.
 */
const nextConfig: NextConfig = {
  // Fly Launch detects this and generates a smaller production image that
  // starts the self-contained `.next/standalone/server.js` output.
  output: 'standalone',

  // Avoid advertising framework details in every response.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/provider-logos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/payout-icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      },
      /**
       * Alert pages carry a capability token in the path (/alerts/manage/<token>).
       * The site-wide policy sends the full URL as the referrer on same-origin
       * navigations, and the next page loads analytics, which records it: the
       * token would end up in analytics. Listed after the site-wide rule
       * so this value wins.
       */
      {
        source: '/alerts/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ]
  },

  /**
   * Next 16 blocks cross-origin requests to dev resources by default, so
   * opening the dev server on 127.0.0.1 rather than localhost breaks hot
   * reload with a console full of failed websocket connections. Both spellings
   * of the loopback address are the same machine.
   *
   * Development only — it has no effect on a production build.
   */
  allowedDevOrigins: ['localhost', '127.0.0.1'],

  async redirects() {
    return [
      /**
       * The rewrites below serve English from the root by pointing at `/en`
       * internally, which leaves `/en/...` externally reachable and serving
       * identical content. Redirect it away permanently so the two forms never
       * compete.
       *
       * Safe against the rewrites: redirects run before `beforeFiles`, and the
       * internal result of a rewrite is not fed back through them.
       */
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },

      /**
       * The comparison pages moved from /send-money-… to /compare/… (PakRemits
       * compares services; it does not send money). Permanent, so search
       * engines move each page's ranking to its new address. Urdu first: the
       * English patterns would not match a /ur/ path anyway, but keeping each
       * locale's group together reads better.
       */
      { source: '/send-money-from-:slug-to-pakistan', destination: '/compare/:slug-to-pakistan', permanent: true },
      { source: '/roshan-digital-account-transfer', destination: '/compare/roshan-digital-account-transfers', permanent: true },
      { source: '/send-money-to-:slug', destination: '/compare/:slug-transfers', permanent: true },
      { source: '/ur/send-money-from-:slug-to-pakistan', destination: '/ur/compare/:slug-to-pakistan', permanent: true },
      { source: '/ur/roshan-digital-account-transfer', destination: '/ur/compare/roshan-digital-account-transfers', permanent: true },
      { source: '/ur/send-money-to-:slug', destination: '/ur/compare/:slug-transfers', permanent: true },

      // Old/internal router paths occasionally escape through copied URLs.
      // Send valid-looking ones to their public equivalents instead of 404ing
      // or exposing a second Urdu URL for the same page.
      { source: '/corridor/:slug', destination: '/compare/:slug-to-pakistan', permanent: true },
      { source: '/rate/:currency', destination: '/:currency-to-pkr', permanent: true },
      { source: '/method/rda', destination: '/compare/roshan-digital-account-transfers', permanent: true },
      { source: '/method/:slug', destination: '/compare/:slug-transfers', permanent: true },
      { source: '/ur/corridor/:slug', destination: '/ur/compare/:slug-to-pakistan', permanent: true },
      { source: '/ur/rate/:currency', destination: '/ur/:currency-to-pkr', permanent: true },
      { source: '/ur/method/rda', destination: '/ur/compare/roshan-digital-account-transfers', permanent: true },
      { source: '/ur/method/:slug', destination: '/ur/compare/:slug-transfers', permanent: true },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        /**
         * Open Graph images.
         *
         * Next derives the image URL from the internal route (/en/corridor/uk/
         * opengraph-image), which the /en redirect below would bounce and which
         * robots.txt disallows. This gives the card a stable public URL that
         * the page metadata can point at instead. An incoming /og/... request
         * does not match the /en redirect, so it reaches this rewrite intact.
         */
        { source: '/og/corridor/:slug.png', destination: '/en/corridor/:slug/opengraph-image' },

        // ─── Pretty URLs, English ────────────────────────────────────────
        // Before /compare/:pair below, which would otherwise claim them. The
        // RDA page is listed ahead of the general "-transfers" pattern, which
        // would also match it.
        { source: '/compare/:slug-to-pakistan', destination: '/en/corridor/:slug' },
        { source: '/compare/roshan-digital-account-transfers', destination: '/en/method/rda' },
        { source: '/compare/:slug-transfers', destination: '/en/method/:slug' },
        { source: '/:currency-to-pkr', destination: '/en/rate/:currency' },

        // ─── Pretty URLs, Urdu ───────────────────────────────────────────
        { source: '/ur/compare/:slug-to-pakistan', destination: '/ur/corridor/:slug' },
        { source: '/ur/compare/roshan-digital-account-transfers', destination: '/ur/method/rda' },
        { source: '/ur/compare/:slug-transfers', destination: '/ur/method/:slug' },
        { source: '/ur/:currency-to-pkr', destination: '/ur/rate/:currency' },

        // ─── Unprefixed English routes ───────────────────────────────────
        { source: '/', destination: '/en' },
        { source: '/how-we-rank', destination: '/en/how-we-rank' },
        { source: '/providers', destination: '/en/providers' },
        { source: '/providers/:slug', destination: '/en/providers/:slug' },
        { source: '/compare', destination: '/en/compare' },
        { source: '/compare/:pair', destination: '/en/compare/:pair' },
        { source: '/about', destination: '/en/about' },
        { source: '/contact', destination: '/en/contact' },
        { source: '/privacy', destination: '/en/privacy' },
        { source: '/affiliate-disclosure', destination: '/en/affiliate-disclosure' },
      ],
    }
  },
}

export default withNextIntl(nextConfig)
