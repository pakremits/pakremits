'use client'

import { ADMIN_MAIN, AdminHeader, Empty, Panel, StatusPill } from '@/components/admin-chrome'
import { ColumnChart } from '@/components/admin-charts'
import type { ProofDay } from '@/lib/admin/stats'
import { useAdminData } from '@/lib/admin/client'
import type { Benchmark } from '@/lib/proof/benchmarks'
import type { ClaimState } from '@/lib/proof/claims'
import { LAUNCH_DATE, THRESHOLDS } from '@/lib/proof/config'
import { formatProofPkrFull } from '@/lib/proof/format'
import type { ProofStats } from '@/lib/proof/stats'
import type { SendCurrency } from '@/lib/db/schema'
import { BenchmarkForm } from './benchmark-form'

/** /admin/api/proof, as JSON: dates arrive as strings. */
interface ProofData {
  stats: Omit<ProofStats, 'computedAt'> & { computedAt: string }
  series: ProofDay[]
  benchmarks: (Omit<Benchmark, 'updatedAt'> & {
    updatedAt: string
    corridorSlug: string
    countryName: string
    currency: SendCurrency
  })[]
  claims: ClaimState[]
}

const TITLE = 'Proof and savings'
const LEDE =
  'The numbers behind every public claim, what the savings are measured against, and the daily rollups the refresh writes.'

/** Human-readable label per claim id, matching the copy on the public page. */
const CLAIM_LABELS: Record<string, string> = {
  pakistanOnly: 'Built only for Pakistan corridors',
  providersRefreshed: 'N providers compared, refreshed on a schedule',
  liveGap: '₨ N more than a typical bank, right now',
  rankedByRupees: 'Ranked by rupees received',
  monthlyActivity: 'N comparisons run this month',
  savingsSinceLaunch: '₨ N saved since launch',
  firstPakistanOnlySite: "Pakistan's first Pakistan-only comparison site",
}

/** The proof layer's numbers and the bank benchmarks. Loads in the browser. */
export function ProofView() {
  const { data, error } = useAdminData<ProofData>('proof')

  if (!data) {
    return (
      <>
        <AdminHeader current="/admin/proof" title={TITLE} lede={LEDE} />
        <main className={ADMIN_MAIN}>
          <Panel title={error ? 'Could not load the proof figures' : 'Loading…'}>
            {error ? <Empty>{error}</Empty> : <div className="skeleton h-40 rounded-[12px]" />}
          </Panel>
        </main>
      </>
    )
  }

  const { stats, series, benchmarks, claims } = data

  const maxSaving = Math.max(...series.map((d) => d.savingPkrTotal), 1)
  const maxCount = Math.max(...series.map((d) => Math.max(d.comparisonsRun, d.clicks)), 1)

  return (
    <>
      <AdminHeader
        current="/admin/proof"
        title={TITLE}
        lede={LEDE}
        status={
          <StatusPill tone="ok">
            {claims.filter((claim) => claim.visible).length} of {claims.length} claims live
          </StatusPill>
        }
      />

      <main className={`${ADMIN_MAIN} space-y-5`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Saved since launch" value={formatProofPkrFull(stats.savingsSinceLaunch)} />
          <Stat label="Saved this month" value={formatProofPkrFull(stats.savingsThisMonth)} />
          <Stat
            label="Comparisons this month"
            value={stats.comparisonsThisMonth.toLocaleString('en-GB')}
          />
          <Stat
            label="Leader changes this month"
            value={String(stats.bestProviderChangesThisMonth)}
          />
        </div>

        <Panel
          title="Claims currently visible"
          hint={`Evaluated against live numbers. Launch date ${LAUNCH_DATE.toISOString().slice(0, 10)}.`}
        >
          <ul className="divide-y divide-line-2">
            {claims.map((claim) => (
              <li key={claim.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={`inline-block w-16 shrink-0 rounded-full px-2 py-0.5 text-center
                              text-[12px] font-semibold ${
                                claim.visible ? 'bg-icon-bg text-ok' : 'bg-line-2 text-muted'
                              }`}
                >
                  {claim.visible ? 'live' : 'hidden'}
                </span>
                <span className="text-[14px] text-ink">
                  {CLAIM_LABELS[claim.id] ?? claim.id}
                </span>
                <span className="text-[13px] text-muted">
                  {claim.id === 'liveGap'
                    ? 'Varies per request — depends on the corridor and amount in the widget.'
                    : claim.reason}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Daily activity"
          hint={`Last 30 days. Bars are savings; the two lines under each are comparisons and clicks. Savings appear on the site past ${formatProofPkrFull(THRESHOLDS.savingsSinceLaunch)}.`}
        >
          {series.length === 0 ? (
            <Empty>No rollup rows yet. The cron writes these at the end of each run.</Empty>
          ) : (
            <>
            <div className="mb-6 rounded-[14px] bg-mist p-4 pt-5">
              <p className="mb-3 text-[13px] font-medium text-muted">Rupees saved per day</p>
              <ColumnChart
                caption="Rupees saved per day, last 30 days"
                unit="saved"
                formatAs="pkr-short"
                data={series.map((day) => ({
                  key: day.date,
                  label: day.date.slice(8),
                  detail: `${day.date} · ${day.comparisonsRun} comparisons`,
                  value: Math.round(day.savingPkrTotal),
                }))}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Day</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Saving</th>
                    <th scope="col" className="w-1/3 py-2 pr-3 font-medium">&nbsp;</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Comparisons</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Clicks</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Leader changes</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((day) => (
                    <tr key={day.date} className="border-b border-line/60">
                      <td className="py-1.5 pr-3 tabular-nums text-muted">{day.date.slice(5)}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-ink">
                        {Math.round(day.savingPkrTotal).toLocaleString('en-GB')}
                      </td>
                      <td className="py-1.5 pr-3">
                        {/* A CSS bar rather than a charting library: one column
                            of 30 values does not justify shipping a dependency. */}
                        <span
                          className="block h-2 rounded-full bg-bar"
                          style={{
                            width: `${Math.max((day.savingPkrTotal / maxSaving) * 100, day.savingPkrTotal > 0 ? 2 : 0)}%`,
                          }}
                          aria-hidden="true"
                        />
                        <span
                          className="mt-1 block h-1 rounded-full bg-gold/60"
                          style={{
                            width: `${Math.max((day.comparisonsRun / maxCount) * 100, day.comparisonsRun > 0 ? 2 : 0)}%`,
                          }}
                          aria-hidden="true"
                        />
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.comparisonsRun}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.clicks}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{day.bestProviderChanges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Panel>

        <Panel
          title="Bank benchmarks"
          hint="What the savings figure is measured against. Saving a row pins it, which stops the weekly refresh regenerating it."
        >
          {benchmarks.length === 0 ? (
            <Empty>
              No benchmarks yet. They are generated on the first cron run, or seeded by
              <code className="mx-1">npm run seed</code>.
            </Empty>
          ) : (
            <table className="w-full border-collapse text-[13.5px]">
              <tbody>
                {benchmarks.map((row) => (
                  <BenchmarkForm
                    key={`${row.corridorId}-${row.deliveryMethod}`}
                    row={{
                      corridorId: row.corridorId,
                      countryName: row.countryName,
                      currency: row.currency,
                      deliveryMethod: row.deliveryMethod,
                      rate: row.rate,
                      fee: row.fee,
                      note: row.note,
                      pinned: row.pinned,
                      updatedAt: new Date(row.updatedAt),
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </main>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel-lg bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,.28)]">
      <p className="text-[13.5px] font-medium text-muted">{label}</p>
      <div className="mt-2 font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </div>
    </div>
  )
}
