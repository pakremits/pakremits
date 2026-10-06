import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'Contact PakRemits | Rate corrections and support',
  description: 'Contact PakRemits to report an incorrect transfer rate, ask about a provider listing or request deletion of your rate-alert details.',
  path: '/contact',
})

/**
 * No form here on purpose. A contact form needs spam handling, storage, and a
 * privacy story of its own; an address needs none of those and works better.
 * TODO: replace the placeholder address before launch.
 */
export default function ContactPage() {
  return (
    <>
      <h1 className="text-[clamp(32px,4.4vw,46px)] leading-[1.06] font-semibold">Contact</h1>

      <p className="mt-5 text-[18px] text-muted">
        Email is the fastest way to reach us. There is no form because a form would mean storing
        your message on our servers, and an address does the same job without that.
      </p>

      <p className="mt-6 font-display text-2xl font-semibold">
        {/* TODO: replace with the real address before launch. */}
        hello@bhejo.pk
      </p>

      <h2 className="mt-10 text-[24px] font-semibold">Reporting a wrong rate</h2>
      <p className="mt-3 text-[16.5px] text-muted">
        This is the message we most want to get. Providers change their pricing structures without
        warning and our parsers occasionally read a new shape incorrectly. Tell us the provider,
        the corridor, and roughly when you looked, and we will check it against the source and fix
        it. A screenshot helps but is not necessary.
      </p>

      <h2 className="mt-10 text-[24px] font-semibold">If you are a provider</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          If you would like to be listed, get in touch — particularly if you can offer a quote API,
          which is far more reliable for both of us than us reading your website.
        </p>
        <p>
          If you would like us to stop fetching quotes from you, say so and we will remove you the
          same day. You do not need to give a reason and you do not need to send a legal letter.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">Data deletion</h2>
      <p className="mt-3 text-[16.5px] text-muted">
        Every rate-alert message has a one-tap unsubscribe link that deletes your contact details
        outright. If you would rather ask us directly, email the address above and we will handle
        it without asking why.
      </p>
    </>
  )
}
