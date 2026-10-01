import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { type Locale } from '@/i18n/routing'
import { staticPath } from '@/lib/routes'
import { claimMap, evaluateClaims } from '@/lib/proof/claims'
import { formatProofPkr, formatProofPkrFull } from '@/lib/proof/format'
import type { ProofStats } from '@/lib/proof/stats'

/** One cell of the strip, shared with the cells callers pass in as `children`. */
export const PROOF_CARD = 'flex flex-col justify-between border-e border-b border-line bg-tint px-6 py-5'

/**
 * The proof strip: claims that are true right now, and nothing else.
 *
 * Which lines appear is decided entirely by `evaluateClaims`, not here — this
 * component only renders what it is told is visible. A claim below its
 * threshold produces no element at all: no greyed-out card, no "0 so far", no
 * placeholder. An empty strip is the correct appearance for a site with no
 * traffic yet, and it is what a fresh deploy shows.
 *
 * `children` are extra <li> cards that belong in the same four-up grid — the
 * design has the claims and the counted-fact cards as one row, not two, so they
 * have to share a grid to come out the same width and height.
 */
export async function ProofStrip({
  locale,
  stats,
  liveGapOnStandardAmount,
  sendAmountLabel,
  children,
}: {
  locale: Locale
  stats: ProofStats
  liveGapOnStandardAmount: number | null
  /** e.g. "£500" — the amount currently in the widget. */
  sendAmountLabel: string
  /** Extra <li> cards for the same grid. */
  children?: React.ReactNode
}) {
  const t = await getTranslations({ locale, namespace: 'proof' })
  const claims = claimMap(evaluateClaims({ stats, liveGapOnStandardAmount }))

  const savingsHref = `${staticPath('how-we-rank', locale)}#savings`
  const benchmarkHref = `${staticPath('how-we-rank', locale)}#bank-benchmark`

  const items: { key: string; body: React.ReactNode; href: string }[] = []

  if (claims.pakistanOnly) {
    items.push({
      key: 'pakistanOnly',
      body: t('pakistanOnly'),
      href: savingsHref,
    })
  }

  if (claims.providersRefreshed) {
    items.push({
      key: 'providersRefreshed',
      body: t('providersRefreshed', {
        providers: stats.providersCompared,
        minutes: stats.refreshMinutes,
      }),
      href: benchmarkHref,
    })
  }

  /*
    The live gap appears exactly once on the page. Day one the hero stat card
    carries it, so repeating it here would be the same sentence twice. Once the
    savings threshold trips, the hero card switches to the cumulative figure and
    the gap moves down into the strip — it is a day-one claim and must not
    silently disappear when a different claim becomes available.
  */
  if (claims.liveGap && claims.savingsSinceLaunch && liveGapOnStandardAmount !== null) {
    items.push({
      key: 'liveGap',
      body: t('liveGap', {
        amount: formatProofPkr(liveGapOnStandardAmount),
        sendAmount: sendAmountLabel,
      }),
      href: benchmarkHref,
    })
  }

  if (claims.rankedByRupees) {
    items.push({
      key: 'rankedByRupees',
      body: t('rankedByRupees'),
      href: savingsHref,
    })
  }

  if (claims.monthlyActivity) {
    items.push({
      key: 'monthlyActivity',
      body: t('monthlyActivity', {
        comparisons: stats.comparisonsThisMonth.toLocaleString('en-GB'),
        changes: stats.bestProviderChangesThisMonth,
      }),
      href: savingsHref,
    })
  }

  if (claims.savingsSinceLaunch) {
    items.push({
      key: 'savingsSinceLaunch',
      body: (
        <>
          {t('savingsSinceLaunch', {
            amount: formatProofPkrFull(stats.savingsSinceLaunch),
          })}{' '}
          <Link href={savingsHref} className="text-leaf underline underline-offset-2">
            {t('savingsSinceLaunchLink')}
          </Link>
        </>
      ),
      href: savingsHref,
    })
  }

  if (items.length === 0 && !children) return null

  return (
    <section className="mt-4" aria-label={t('stripLabel')}>
      {/* One ruled strip, not more cards: these are measurements, read side by side.
          -mb-px/-me-px tuck the outer cells' rules under the frame. */}
      <div className="card-rise overflow-hidden rounded-panel border border-line">
        <ul className="-me-px -mb-px grid sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.key} className={PROOF_CARD}>
              <p className="text-[15px] leading-[1.4] font-medium text-ink">{item.body}</p>
              <Link
                href={item.href}
                className="mt-3 inline-block self-start text-[13px] text-muted underline underline-offset-2
                           hover:text-leaf"
              >
                {t('howWeCount')}
              </Link>
            </li>
          ))}
          {children}
        </ul>
      </div>
    </section>
  )
}

/**
 * The single hero stat that swaps once the savings threshold is met.
 *
 * Day one it is the live gap on the amount in the widget. Past 25 lakh it
 * becomes the cumulative figure, which is the brief's instruction to replace
 * the typical-saving card rather than show both.
 */
export function heroSavingStat({
  stats,
  liveGapOnStandardAmount,
}: {
  stats: ProofStats
  liveGapOnStandardAmount: number | null
}): { value: string; mode: 'sinceLaunch' | 'liveGap' } | null {
  const claims = claimMap(evaluateClaims({ stats, liveGapOnStandardAmount }))

  if (claims.savingsSinceLaunch) {
    return { value: formatProofPkr(stats.savingsSinceLaunch), mode: 'sinceLaunch' }
  }

  if (claims.liveGap && liveGapOnStandardAmount !== null) {
    return { value: formatProofPkr(liveGapOnStandardAmount), mode: 'liveGap' }
  }

  return null
}
