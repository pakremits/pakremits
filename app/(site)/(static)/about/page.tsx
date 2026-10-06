import type { Metadata } from 'next'
import Link from 'next/link'
import { staleAfterPhrase } from '@/lib/cadence'
import { publicPageMetadata } from '@/lib/seo'

export const metadata: Metadata = publicPageMetadata({
  title: 'About PakRemits | Compare transfers to Pakistan',
  description: 'Learn how PakRemits compares money transfers to Pakistan by the rupees received after fees and exchange rates, and why we show our working.',
  path: '/about',
})

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[clamp(32px,4.4vw,46px)] leading-[1.06] font-semibold">About PakRemits</h1>

      <p className="mt-5 text-[18px] text-muted">
        PakRemits compares money transfer services for people sending to Pakistan, ranked by the
        rupees that actually arrive.
      </p>

      <h2 className="mt-10 text-[24px] font-semibold">Why it exists</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          Remittance pricing is deliberately hard to compare. A service advertises a zero fee and
          takes three percent in the exchange rate. Another advertises a great rate and charges a
          flat fee that dominates on small transfers. A bank does both and hopes you do not check.
        </p>
        <p>
          None of that is comparable at a glance, which is the point. The only number that settles
          it is how many rupees land in the recipient’s account, and that requires computing the
          whole thing for every provider, at your amount, at this moment. That is all this site
          does.
        </p>
        <p>
          The amounts involved are not trivial. A family sending a few hundred pounds a month
          through the wrong channel loses a meaningful fraction of a year’s support to spread they
          never see itemised.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">What we do differently</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          <b className="text-ink">We normalise the fee models.</b> Some providers deduct their fee
          from what you send; others charge it on top. Comparing those at face value quietly
          favours the second kind. Every row here answers the same question instead: if you part
          with this much in total, what arrives?
        </p>
        <p>
          <b className="text-ink">We cover Pakistani rails properly.</b> JazzCash, Easypaisa,
          cash pickup and mobile wallets can have different rates and delivery times. We keep
          SadaPay, NayaPay and Roshan Digital Accounts visible as familiar destinations, while
          showing general bank-deposit quotes for those accounts.
        </p>
        <p>
          <b className="text-ink">We show our working.</b> Every quote carries a capture time,
          anything over {staleAfterPhrase()} old is flagged stale rather than presented as
          current, and{' '}
          <Link href="/how-we-rank" className="text-leaf underline underline-offset-2">
            how we rank
          </Link>{' '}
          names the file that does the sorting.
        </p>
      </div>

      <h2 className="mt-10 text-[24px] font-semibold">What we deliberately do not do</h2>
      <div className="mt-3 space-y-4 text-[16.5px] text-muted">
        <p>
          We do not list a provider unless we can get a real live quote from them without working
          around their website. Several large services put their quote flow behind bot protection,
          and a couple ask not to be crawled at all. We respect that, and the cost is that our
          tables are shorter than they could be.
        </p>
        <p>
          We also do not give financial advice, hold funds, or take a cut of your transfer. We are
          a comparison table with opinions about arithmetic.
        </p>
      </div>
    </>
  )
}
