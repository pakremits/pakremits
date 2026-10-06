import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'PakRemits privacy policy | Rate alerts and data',
  description: 'Read what PakRemits stores when you set a rate alert, how comparison visits are handled and how to delete your alert and contact details.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-[clamp(32px,4.4vw,46px)] leading-[1.06] font-semibold">Privacy</h1>

      <p className="mt-5 text-[18px] text-muted">
        PakRemits is a comparison site. We are not a money transfer service, we never hold your funds,
        and we never see your bank details.
      </p>

      <h2 className="mt-10 text-[24px] font-semibold">What we collect</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          <b className="text-ink">Nothing, to browse.</b> You can use every comparison table on
          this site without giving us anything. There is no account, no login, and no advertising
          tracker following you around.
        </p>
        <p>
          <b className="text-ink">A rate alert stores one contact detail.</b> If you set a rate
          alert we store the email address or phone number you gave us, the currency pair, your
          target rate, and when we last messaged you. That is the entire record. We use it to send
          you the alert you asked for and nothing else, and we never sell or share it.
        </p>
        <p>
          <b className="text-ink">Clicks through to providers are logged.</b> When you use a
          provider link we record which provider, which corridor, the amount bracket, and a random
          identifier. We do not attach your name, email or IP address to it. This is how we get
          paid and how we know which comparisons are useful.
        </p>
        <p>
          <b className="text-ink">Site measurement.</b> We load Google Tag Manager on public pages
          to manage measurement tags. Any tags enabled through that container may have their own
          data and cookie practices. We review those tags before enabling them and update this
          notice when our measurement changes.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">Deleting your details</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          Every alert message contains a one-tap unsubscribe link. Using it does not merely stop
          the messages — it deletes the contact details from our database. We do not keep a
          suppression list of people who have left, because keeping your address in order to
          remember not to write to you is still keeping your address.
        </p>
        <p>
          If you would like anything else removed, or want to know what we hold, write to us and we
          will deal with it. You do not need to give a reason.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">Where the data lives</h2>
      <p className="mt-3 text-[16.5px] text-muted">
        Our database is hosted with a managed provider and access is restricted to the site’s own
        servers — the database is not reachable from the public internet. Alert contact details are
        not readable by any client-side code.
      </p>

      <p className="mt-10 text-[13px] text-faint">
        {/* Honest about scope: this is a plain-English summary, not a legal document. */}
        This page is a plain-English description of what we actually do, written to be read rather
        than to satisfy a lawyer. If you need a formal notice for a compliance process, ask and we
        will provide one.
      </p>
    </>
  )
}
