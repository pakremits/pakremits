import type { Metadata } from 'next'
import { AdminNav, Empty, Panel } from '@/components/admin-chrome'
import {
  adapterHealth,
  alertStats,
  clickTotals,
  clicksByDay,
  monetisationGap,
  recentCronRuns,
} from '@/lib/admin/stats'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dashboard — PakRemits admin', robots: { index: false } }

const PKT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Minutes since a timestamp.
 *
 * Module scope rather than the component body on purpose: a clock read during
 * render is not idempotent, which react-hooks/purity flags. The read is still
 * request-time — this page is force-dynamic, so it happens once per request,
 * which is exactly what the staleness check wants.
 */
function minutesSince(date: Date): number {
  return (Date.now() - date.getTime()) / 60_000
}

/** How long since a timestamp, in the roughest useful unit. */
function ago(date: Date | null): string {
  if (!date) return 'never'
  const minutes = Math.round(minutesSince(date))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** The refresh runs every 15 minutes, so anything past 45 is a problem. */
const STALE_AFTER_MINUTES = 45

export default async function AdminDashboard() {
  const [totals, byDay, alerts, health, crons, gap] = await Promise.all([
    clickTotals(),
    clicksByDay(14),
    alertStats(),
    adapterHealth(),
    recentCronRuns(),
    monetisationGap(),
  ])

  const lastRun = crons.at(0)
  const lastRunAge = lastRun ? minutesSince(lastRun.startedAt) : null
  const cronLooksDead = lastRunAge === null || lastRunAge > STALE_AFTER_MINUTES

  const unmonetisedClicks = gap
    .filter((row) => !row.monetised)
    .reduce((sum, row) => sum + row.clicks, 0)

  return (
    <>
      <AdminNav current="/admin" />

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        {/* The one alarm worth putting above everything else: if the cron has
            stopped, every number on the site is quietly going stale. */}
        {cronLooksDead && (
          <p
            role="alert"
            className="mb-6 rounded-panel border border-[#E0B4B4] bg-[#FDF1F1] p-4 text-[15px] text-[#A32D2D]"
          >
            <b>The refresh has not run recently.</b>{' '}
            {lastRun
              ? `Last started ${ago(lastRun.startedAt)}. It should run every 15 minutes.`
              : 'There is no record of it ever running.'}{' '}
            Check the Actions tab in GitHub — the schedule is best-effort and does stop.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Clicks today', value: totals.today },
            { label: 'Last 7 days', value: totals.last7 },
            { label: 'Last 30 days', value: totals.last30 },
            { label: 'Alerts (confirmed)', value: `${alerts.confirmed} / ${alerts.total}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-panel border border-line bg-white p-5">
              <div className="font-display text-[32px] leading-none font-semibold tabular-nums">
                {stat.value}
              </div>
              <div className="mt-2 text-[13px] text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        {unmonetisedClicks > 0 && (
          <p className="mt-4 rounded-panel border border-line bg-gold-bg p-4 text-[14.5px] text-gold-dark">
            <b>{unmonetisedClicks} clicks</b> went to providers with no affiliate template set, so
            they earned nothing. Add the tracking URL on the providers page once each programme is
            approved.
          </p>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Panel title="Adapter health" hint="Captures in the last 24 hours, per provider.">
            {health.length === 0 ? (
              <Empty>No providers configured.</Empty>
            ) : (
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-line-2 text-left text-xs text-faint">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Last capture</th>
                    <th className="pb-2 text-right font-medium">Fresh</th>
                    <th className="pb-2 text-right font-medium">Stale</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {health.map((row) => {
                    const dead = !row.lastCapture
                    const degraded = row.staleRows > 0
                    return (
                      <tr key={row.slug} className="border-b border-line-2 last:border-0">
                        <td className="py-2.5">{row.provider}</td>
                        <td
                          className={`py-2.5 ${dead ? 'text-[#A32D2D]' : degraded ? 'text-gold-dark' : 'text-muted'}`}
                        >
                          {ago(row.lastCapture)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{row.freshRows}</td>
                        <td
                          className={`py-2.5 text-right tabular-nums ${row.staleRows > 0 ? 'font-medium text-gold-dark' : 'text-faint'}`}
                        >
                          {row.staleRows}
                        </td>
                        <td className="py-2.5 text-[13px] text-muted">
                          {row.sources.join(', ') || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[12.5px] text-faint">
              A provider with no capture in 24 hours is either disabled or its adapter is broken. A
              stale count above zero means the adapter failed and the previous quote was re-served.
            </p>
          </Panel>

          <Panel title="Recent cron runs" hint="Started, duration, and what failed.">
            {crons.length === 0 ? (
              <Empty>No runs recorded yet.</Empty>
            ) : (
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-line-2 text-left text-xs text-faint">
                    <th className="pb-2 font-medium">Started (PKT)</th>
                    <th className="pb-2 text-right font-medium">Quotes</th>
                    <th className="pb-2 text-right font-medium">OK</th>
                    <th className="pb-2 text-right font-medium">Failed</th>
                    <th className="pb-2 font-medium">Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {crons.map((run) => (
                    <tr key={run.id} className="border-b border-line-2 last:border-0">
                      <td className="py-2.5 tabular-nums">{PKT.format(run.startedAt)}</td>
                      <td className="py-2.5 text-right tabular-nums">{run.quotesWritten}</td>
                      <td className="py-2.5 text-right tabular-nums">{run.adaptersOk}</td>
                      <td
                        className={`py-2.5 text-right tabular-nums ${run.adaptersFailed > 0 ? 'text-gold-dark' : 'text-faint'}`}
                      >
                        {run.adaptersFailed}
                      </td>
                      <td className="py-2.5 text-[13px] text-muted">
                        {run.finishedAt ? ago(run.finishedAt) : <span className="text-[#A32D2D]">did not finish</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Clicks by day" hint="Last 14 days, by provider and corridor.">
            {byDay.length === 0 ? (
              <Empty>No clicks recorded yet.</Empty>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line-2 text-left text-xs text-faint">
                      <th className="pb-2 font-medium">Day</th>
                      <th className="pb-2 font-medium">Provider</th>
                      <th className="pb-2 font-medium">Corridor</th>
                      <th className="pb-2 text-right font-medium">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((row, index) => (
                      <tr
                        key={`${row.day}-${row.provider}-${row.corridor}-${index}`}
                        className="border-b border-line-2 last:border-0"
                      >
                        <td className="py-2.5 tabular-nums text-muted">{row.day}</td>
                        <td className="py-2.5">{row.provider}</td>
                        <td className="py-2.5 text-muted">{row.corridor ?? '—'}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums">{row.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Rate alerts"
            hint="Volumes only — contact details are never shown here."
          >
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
              <div>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {alerts.confirmed}
                </div>
                <div className="text-[13px] text-muted">confirmed</div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {alerts.awaitingConfirmation}
                </div>
                <div className="text-[13px] text-muted">awaiting opt-in</div>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {alerts.wantsDigest}
                </div>
                <div className="text-[13px] text-muted">want the digest</div>
              </div>
            </div>

            {alerts.byCurrency.length > 0 && (
              <p className="mt-4 border-t border-line-2 pt-3 text-[13.5px] text-muted">
                By pair:{' '}
                {alerts.byCurrency.map((row) => `${row.currency} ${row.count}`).join(' · ')}
              </p>
            )}

            {alerts.recent.length === 0 ? (
              <Empty>No alerts yet.</Empty>
            ) : (
              <table className="mt-4 w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-line-2 text-left text-xs text-faint">
                    <th className="pb-2 font-medium">Created (PKT)</th>
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Watching</th>
                    <th className="pb-2 font-medium">Opted in</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.recent.map((row, index) => (
                    <tr key={index} className="border-b border-line-2 last:border-0">
                      <td className="py-2.5 tabular-nums text-muted">{PKT.format(row.createdAt)}</td>
                      <td className="py-2.5">{row.channel}</td>
                      <td className="py-2.5 tabular-nums">
                        {row.currency} {row.direction === 'above' ? '≥' : '≤'}{' '}
                        {row.target.toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        {row.confirmed ? (
                          <span className="text-[#037252]">yes</span>
                        ) : (
                          <span className="text-muted">pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </main>
    </>
  )
}
