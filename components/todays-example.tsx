import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { type Locale } from '@/i18n/routing'
import { ProviderLogo } from '@/components/provider-logo'
import { formatPkr } from '@/lib/ranking/compute'
import type { Comparison } from '@/lib/quotes'
import { staticPath } from '@/lib/routes'

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Karachi',
})

/** Beyond this the bars get too thin to tell apart, and the full table is one click away. */
const MAX_PROVIDERS = 4

/**
 * "What £500 turns into today": one real comparison, drawn as rupees received.
 *
 * Bars start at zero on purpose. A cropped axis would make a 9% gap look like
 * a 90% one, and the whole site's pitch is that its numbers are not dressed up.
 * The gold bracket measures the gap on the same scale as the bars.
 *
 * Renders nothing unless there are at least two rows to compare — a single
 * provider has no gap to show.
 */
export async function TodaysExample({
  locale,
  comparison,
  countryName,
  sendLabel,
  compareHref,
}: {
  locale: Locale
  comparison: Comparison | null
  countryName: string
  /** e.g. "£500". */
  sendLabel: string
  compareHref: string
}) {
  if (!comparison || comparison.unavailable) return null

  const t = await getTranslations({ locale, namespace: 'home' })
  const tProof = await getTranslations({ locale, namespace: 'proof' })

  const providers = comparison.rows.filter((row) => !row.quote.isBenchmark).slice(0, MAX_PROVIDERS)
  const bank = comparison.rows.find((row) => row.quote.isBenchmark) ?? null
  const best = providers.find((row) => row.isBest)
  if (!best) return null

  // Measure the gap against the bank when we have one, else against the weakest service.
  const baseline =
    bank && bank.quote.amountReceived < best.quote.amountReceived ? bank : providers.at(-1)
  if (!baseline || baseline === best) return null

  const top = best.quote.amountReceived
  const gap = top - baseline.quote.amountReceived
  const pct = (amount: number) => Math.max(2, (amount / top) * 100)
  const rows = baseline === bank ? [...providers, bank] : providers

  return (
    <section id="example" aria-labelledby="example-title" className="mt-16">
      <div
        className="grid overflow-hidden rounded-panel-lg border border-line bg-surface
                   lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="border-b border-line-2 p-7 sm:p-9 lg:border-e lg:border-b-0">
          <h2
            id="example-title"
            className="text-[clamp(26px,3vw,30px)] leading-[1.15] font-semibold"
          >
            {t('exampleTitle', { amount: sendLabel })}
          </h2>
          <p className="mt-2 text-[15px] text-muted">{t('exampleRoute', { country: countryName })}</p>

          <p
            className="mt-8 font-hero text-[clamp(46px,6vw,68px)] leading-none font-bold
                       tracking-[-0.035em] text-green tabular-nums"
          >
            {formatPkr(gap)}
          </p>
          <p className="mt-3 max-w-[36ch] text-[16px] leading-relaxed text-ink-2">
            {baseline === bank
              ? t('exampleGapBank', { amount: sendLabel })
              : t('exampleGapSpread', { amount: sendLabel })}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href={compareHref}
              className="flex h-12 items-center rounded-control bg-gold px-6 text-[16px] font-bold
                         text-on-gold no-underline transition-colors hover:bg-gold-hover"
            >
              {t('exampleCta')}
            </Link>
            <Link
              href={`${staticPath('how-we-rank', locale)}#bank-benchmark`}
              className="text-[14px] text-muted underline underline-offset-2 hover:text-leaf"
            >
              {tProof('howWeCount')}
            </Link>
          </div>
        </div>

        <div className="p-7 sm:p-9">
          {comparison.capturedAt && (
            <p className="text-[13px] text-muted">
              {t('exampleListLabel', { time: TIME_FMT.format(comparison.capturedAt) })}
            </p>
          )}

          <ol className="mt-6 space-y-6">
            {rows.map((row) => {
              const isBank = row.quote.isBenchmark
              return (
                <li key={row.quote.providerSlug}>
                  <div className="flex items-center gap-3">
                    {isBank ? (
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-mist text-muted"
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                          <path d="m3 9 9-5 9 5M5 10h14M6 10v7m4-7v7m4-7v7m4-7v7M4 20h16" />
                        </svg>
                      </span>
                    ) : (
                      <ProviderLogo
                        providerSlug={row.quote.providerSlug}
                        providerName={row.quote.providerName}
                        brandColor={row.quote.brandColor}
                        brandTextColor={row.quote.brandTextColor}
                        size="small"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {isBank ? t('exampleBank') : row.quote.providerName}
                    </span>
                    {row.isBest && (
                      <span className="hidden rounded-full bg-tint px-2.5 py-0.5 text-[12px] font-semibold text-tint-ink sm:inline">
                        {t('exampleBest')}
                      </span>
                    )}
                    <b className="font-display text-[17px] font-semibold tabular-nums">
                      {formatPkr(row.quote.amountReceived)}
                    </b>
                  </div>

                  <div className="relative mt-2.5 h-2.5">
                    <div
                      className={`absolute inset-y-0 start-0 rounded-full ${
                        row.isBest ? 'bg-bar' : isBank ? 'bg-bar-low' : 'bg-line'
                      }`}
                      style={{ width: `${pct(row.quote.amountReceived)}%` }}
                    />
                  </div>

                  {row === baseline && (
                    // The dimension line: from where this bar stops to where the best one does.
                    <div className="relative mt-2 h-9" aria-hidden="true">
                      <div
                        className="absolute top-0 h-2.5 border-x-2 border-b-2 border-gold"
                        style={{ insetInlineStart: `${pct(row.quote.amountReceived)}%`, insetInlineEnd: 0 }}
                      />
                      <span className="absolute end-0 top-4 text-[13px] font-semibold whitespace-nowrap text-gold-dark tabular-nums">
                        {t('exampleGapMark', { amount: formatPkr(gap) })}
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
