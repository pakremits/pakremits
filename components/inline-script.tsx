'use client'

/**
 * An inline script that runs while the HTML is parsed (before first paint)
 * without React's dev warning about <script> tags in components: the server
 * renders it as JavaScript, the client as inert text, and
 * suppressHydrationWarning accepts the difference. The Next.js pattern from
 * docs/01-app/02-guides/preventing-flash-before-hydration.md. A client
 * component so the `typeof window` check runs in the browser too.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
