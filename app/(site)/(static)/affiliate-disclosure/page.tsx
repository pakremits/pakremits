import type { Metadata } from 'next'
import Link from 'next/link'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'Affiliate disclosure | How PakRemits earns money',
  description: 'See how PakRemits earns commissions from some provider links and why payments do not change the ranking of transfer rates to Pakistan.',
  path: '/affiliate-disclosure',
})

export default function AffiliateDisclosurePage() {
  return (
    <>
      <h1 className="text-[clamp(32px,4.4vw,46px)] leading-[1.06] font-semibold">
        Affiliate disclosure
      </h1>

      <p className="mt-5 text-[18px] text-muted">
        PakRemits is free to use. We make money when someone signs up with a provider through one of
        our links, and we would rather explain exactly how that works than bury it.
      </p>

      <h2 className="mt-10 text-[24px] font-semibold">What we earn</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          Some of the providers listed here run affiliate programmes, generally through networks
          like Impact or CJ Affiliate. When a new customer signs up and completes a first transfer
          after clicking through from PakRemits, the provider pays us a fixed amount. It is a one-off
          bounty per customer, not a share of your transfer, and it does not come out of your
          money — your rate is identical whether you arrive from here or type their address in
          directly.
        </p>
        <p>
          Not every provider pays us. Where a provider has no programme, or where we have not been
          approved for one, our link simply goes to their site and we earn nothing. Those providers
          are ranked in exactly the same way as the ones that do pay.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">Why it does not affect the ranking</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          The obvious worry about a site like this is that the order reflects who pays best. It
          does not, and we have tried to make that structurally true rather than a promise you have
          to take on trust.
        </p>
        <p>
          Tables are sorted purely by the rupees that reach the recipient. The code that does the
          sorting receives the amount received, the fee and the delivery speed — commission is not
          one of its inputs, so it cannot be weighted by it. There is an automated test that fails
          if a sponsored provider ever changes which row is marked as the best deal.
        </p>
        <p>
          A provider can pay to have a <b>Sponsored</b> label pinned directly below the best deal.
          Never above it, and always labelled. That is the full extent of what money buys on this
          site.{' '}
          <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
            How we rank
          </Link>{' '}
          goes through the mechanics in more detail.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">Where you will see this</h2>
      <p className="mt-3 text-[16.5px] text-muted">
        Every page carrying provider links repeats the disclosure in its footer, and outbound
        affiliate links are marked <code>rel=&quot;sponsored nofollow&quot;</code> so search
        engines treat them correctly. If you would rather not pass through our link at all, every
        provider is easy to find directly and we will not think less of you for it.
      </p>
    </>
  )
}
