import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

// Points next-intl at i18n/request.ts, which supplies the messages.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * A fully static site.
 *
 * `next build` writes every page, the data files and the share images to
 * out/, which Cloudflare serves as static assets (wrangler.jsonc). Nothing
 * renders on request, so this file has no rewrites, redirects or headers:
 * scripts/write-static-config.ts generates out/_redirects and out/_headers,
 * which Cloudflare applies to the assets instead. The site is rebuilt after
 * every rate refresh.
 */
const nextConfig: NextConfig = {
  output: 'export',

  // /compare/uk-to-pakistan, not /compare/uk-to-pakistan/: pages are written
  // as compare/uk-to-pakistan.html, which Cloudflare serves at the bare URL.
  trailingSlash: false,

  // A static host has no image optimiser; images ship pre-sized instead.
  images: { unoptimized: true },

  /**
   * Next 16 blocks cross-origin requests to dev resources by default, so
   * opening the dev server on 127.0.0.1 rather than localhost breaks hot
   * reload with a console full of failed websocket connections. Both spellings
   * of the loopback address are the same machine.
   *
   * Development only — it has no effect on a production build.
   */
  allowedDevOrigins: ['localhost', '127.0.0.1'],
}

export default withNextIntl(nextConfig)
