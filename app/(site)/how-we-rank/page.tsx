import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { SavingsMethodology } from '@/components/savings-methodology'
import { DEFAULT_LOCALE } from '@/i18n/routing'
import { staleAfterPhrase } from '@/lib/cadence'
import { publicPageMetadata } from '@/lib/seo'

/**
 * The methodology page.
 *
 * This is the page the footer disclosure, the "Best deal" tag and the bank
 * benchmark row all point at. It has to be specific enough to be checkable —
 * a vague promise about independence is worth nothing, so this names the file
 * that does the ranking and the test that enforces it.
 */
export const metadata: Metadata = publicPageMetadata({
  title: 'How PakRemits ranks money transfer rates to Pakistan',
  description: 'Learn how PakRemits compares transfer rates and fees by the rupees a recipient receives, how affiliate links work and when quotes may be unavailable.',
  path: '/how-we-rank',
})

/**
 * The savings total and the benchmark table are read from the database when
 * the site is built, which happens after every refresh, so they move with it.
 */
export default async function HowWeRankPage() {
  const locale = DEFAULT_LOCALE
  setRequestLocale(locale)

  return (
    <>
      <SiteHeader locale={locale} />

      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="no-underline hover:text-leaf">
                PakRemits
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">How we rank</li>
          </ol>
        </nav>

        <h1 className="mt-5 max-w-[20ch] text-[clamp(34px,4.6vw,52px)] leading-[1.05] font-semibold">
          How we rank
        </h1>

        <article className="mt-8 max-w-[68ch]">
          <p className="text-[18px] text-muted">
            Every table on this site is sorted by one number: the rupees that reach the recipient’s
            account. Not the exchange rate, not the fee, not who pays us.
          </p>

          <section className="mt-10">
            <h2 className="text-[26px] leading-tight font-semibold">The calculation</h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              <p>
                For each provider we take their live exchange rate and their fee, and compute what
                lands in Pakistan if you part with a fixed amount in total. The formula is
                deliberately boring: subtract the fee from what you hand over, convert the
                remainder at their rate, round to two decimals.
              </p>
              <p>
                The subtlety is that providers do not all charge their fee the same way. Wise takes
                its fee out of the amount you send. Remitly charges on top, so £500 plus a fee means
                you are out of pocket more than £500. Comparing those two at face value would
                quietly favour the second one.
              </p>
              <p>
                So every row on this site answers the same question — <em>I have this much to
                spend in total, what arrives?</em> — regardless of how the provider frames its own
                pricing. That normalisation is the single most important thing we do, and it is why
                our order sometimes differs from a provider’s own comparison page.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] leading-tight font-semibold">
              Commission cannot move a provider up
            </h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              <p>
                We earn a commission from some providers when a new customer signs up through our
                link. That is how the site pays for itself, and it is disclosed in the footer of
                every page and next to every provider link.
              </p>
              <p>
                It does not enter the ranking. The function that sorts the table takes the amount
                received, the fee, and the delivery speed. It has no parameter for commission at
                all, which means the weighting cannot be added by accident or quietly turned on
                later — it would take a visible code change, and there is a test that fails if
                sponsorship changes which row is marked best.
              </p>
              <p>
                A provider can pay for a <b>Sponsored</b> label, which pins their row directly
                below the best deal. Never above it. If a sponsored provider is genuinely the best
                option, it ranks first on merit and keeps the gold highlight — but nothing it pays
                us can put it there.
              </p>
            </div>
          </section>

          <section id="bank-benchmark" className="mt-10 scroll-mt-8">
            <h2 className="text-[26px] leading-tight font-semibold">The bank benchmark row</h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              <p>
                The grey “Bank Transfer” row at the bottom of each table is not a live
                quote from a specific bank. It is a reference point, calculated from the live
                mid-market rate using a typical retail markup and a typical wire fee for that
                corridor.
              </p>
              <p>
                We include it because the honest comparison for most people is not
                “which app is best” but “is any of this better than what my bank does”. The answer
                is usually yes, by a lot, and the size of that gap is the most useful number on the
                page.
              </p>
              <p>
                It is clearly labelled, always sorts last, and never carries an affiliate link — we
                make nothing from it. Each benchmark is stored with the date it was set and
                refreshed weekly from the live mid-market rate, so it tracks the market without
                being a number we picked once and left there. The current figures, and when each
                was last updated, are in the table under{' '}
                <Link href="#savings" className="text-leaf underline underline-offset-2">
                  how we count savings
                </Link>
                . If your own bank does better than the benchmark, good; the row is a typical case,
                not a worst case.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] leading-tight font-semibold">What we do not cover</h2>
            <div className="mt-3 space-y-4 text-[16.5px] text-muted">
              <p>
                We list a provider only where we can fetch a genuine live quote without working
                around their website. Several large services put their quote flow behind bot
                protection, and two more ask in their robots.txt not to be crawled at all. We
                respect both, which means those providers do not appear here even though they
                operate in these corridors.
              </p>
              <p>
                The consequence is that our tables are shorter than some comparison sites’. We
                think a short table of real numbers beats a long one padded with estimates, but you
                should know it is a limitation rather than a complete picture of the market. Local
                exchange houses, in particular, are often competitive and almost never quotable
                automatically.
              </p>
              <p>
                Quotes are indicative. The provider confirms the final rate on their own site
                before you pay, and it can move between our capture and your transfer. Every table
                shows when its figures were captured, and anything older than {staleAfterPhrase()}{' '}
                is flagged stale rather than presented as current.
              </p>
            </div>
          </section>

          <SavingsMethodology />

          <section className="mt-10">
            <h2 className="text-[26px] leading-tight font-semibold">Corrections</h2>
            <p className="mt-3 text-[16.5px] text-muted">
              If a number here is wrong, tell us and we will fix it. Providers change their pricing
              structures without warning and our parsers occasionally read a new shape incorrectly.
              We would rather hear about it than have it sit there.{' '}
              <Link href="/contact" className="text-leaf underline underline-offset-2">
                Contact us
              </Link>
              .
            </p>
          </section>
        </article>
      </main>

      <SiteFooter locale={locale} />
    </>
  )
}
