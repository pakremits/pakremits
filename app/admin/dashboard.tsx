'use client'

import Link from 'next/link'
import {
  ADMIN_MAIN,
  AdminHeader,
  Dot,
  Empty,
  Panel,
  StatusPill,
  TABLE,
  TD,
  TH,
  THEAD_ROW,
  TR,
} from '@/components/admin-chrome'
import { BarList, ColumnChart, MiniBars } from '@/components/admin-charts'
import { useAdminData } from '@/lib/admin/client'
import type { AdapterHealth, AlertStats, ClickTotals, ClicksByDay } from '@/lib/admin/stats'
import { STALE_AFTER_MS, refreshCadence, staleAfterPhrase } from '@/lib/cadence'

/** /admin/api/dashboard, as JSON: dates arrive as strings. */
interface DashboardData {
  totals: ClickTotals
  byDay: ClicksByDay[]
  alerts: Omit<AlertStats, 'recent'> & {
    recent: (Omit<AlertStats['recent'][number], 'createdAt'> & { createdAt: string })[]
  }
  health: (Omit<AdapterHealth, 'lastCapture'> & { lastCapture: string | null })[]
  crons: {
    id: number
    startedAt: string
    finishedAt: string | null
    quotesWritten: number
    adaptersOk: number
    adaptersFailed: number
  }[]
  gap: { provider: string; monetised: boolean; clicks: number }[]
}

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
 * render is not idempotent, which react-hooks/purity flags. The page renders
 * once its data arrives, so this is the time of that load.
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

/** The last `count` UTC days, oldest first, as YYYY-MM-DD (the clicks query's day key). */
function lastDays(count: number): string[] {
  const today = Date.now()
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  )
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' })
const DAY_DETAIL = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "+40% vs last week" as a chip: arrow and words, never colour alone. */
function Delta({ now, before, against }: { now: number; before: number; against: string }) {
  if (before === 0 && now === 0) return <span className="text-[12.5px] text-faint">No clicks {against} either</span>
  const up = now >= before
  const text =
    before === 0 ? `New ${against === 'yesterday' ? 'today' : 'this week'}` : `${Math.round(Math.abs((now - before) / before) * 100)}% vs ${against}`
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
        up ? 'bg-icon-bg text-ok' : 'bg-danger-bg text-danger'
      }`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {text}
    </span>
  )
}

/** A refresh later than the stale threshold is a problem. */
const STALE_AFTER_MINUTES = STALE_AFTER_MS / 60_000

const TITLE = 'Dashboard'
const LEDE = 'Clicks out, the quote refresh, and rate alerts, at a glance.'

/** The admin home: clicks, the refresh and rate alerts. Loads in the browser. */
export function Dashboard() {
  const { data, error } = useAdminData<DashboardData>('dashboard')

  if (!data) {
    return (
      <>
        <AdminHeader current="/admin" title={TITLE} lede={LEDE} />
        <main className={ADMIN_MAIN}>
          <Panel title={error ? 'Could not load the dashboard' : 'Loading…'}>
            {error ? <Empty>{error}</Empty> : <div className="skeleton h-40 rounded-[12px]" />}
          </Panel>
        </main>
      </>
    )
  }

  const { totals, byDay, alerts: alertsJson, gap } = data
  const health = data.health.map((row) => ({
    ...row,
    lastCapture: row.lastCapture ? new Date(row.lastCapture) : null,
  }))
  const crons = data.crons.map((run) => ({
    ...run,
    startedAt: new Date(run.startedAt),
    finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
  }))
  const alerts = {
    ...alertsJson,
    recent: alertsJson.recent.map((row) => ({ ...row, createdAt: new Date(row.createdAt) })),
  }

  const lastRun = crons.at(0)
  const lastRunAge = lastRun ? minutesSince(lastRun.startedAt) : null
  const cronLooksDead = lastRunAge === null || lastRunAge > STALE_AFTER_MINUTES

  const unmonetisedClicks = gap
    .filter((row) => !row.monetised)
    .reduce((sum, row) => sum + row.clicks, 0)

  const healthy = health.filter((row) => row.lastCapture && row.staleRows === 0).length

  // Daily totals for the last 14 days, empty days included.
  const perDay = new Map<string, number>()
  for (const row of byDay) perDay.set(row.day, (perDay.get(row.day) ?? 0) + row.clicks)
  const days = lastDays(14).map((day) => {
    const date = new Date(`${day}T00:00:00Z`)
    return { key: day, label: DAY_LABEL.format(date), detail: DAY_DETAIL.format(date), value: perDay.get(day) ?? 0 }
  })
  const values = days.map((day) => day.value)
  const sum = (list: number[]) => list.reduce((total, value) => total + value, 0)
  const thisWeek = sum(values.slice(7))
  const lastWeek = sum(values.slice(0, 7))
  const fortnight = sum(values)

  const perProvider = new Map<string, number>()
  for (const row of byDay) perProvider.set(row.provider, (perProvider.get(row.provider) ?? 0) + row.clicks)
  const providerBars = [...perProvider]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([provider, clicks]) => ({ key: provider, label: provider, value: clicks }))

  const optIn = alerts.total ? Math.round((alerts.confirmed / alerts.total) * 100) : null

  return (
    <>
      <AdminHeader
        current="/admin"
        title={TITLE}
        lede={LEDE}
        status={
          <>
            <StatusPill tone={cronLooksDead ? 'bad' : 'ok'}>
              {cronLooksDead
                ? `Refresh stalled${lastRun ? ` · last run ${ago(lastRun.startedAt)}` : ''}`
                : `Refresh healthy · ${ago(lastRun!.startedAt)}`}
            </StatusPill>
            <StatusPill tone={healthy === health.length ? 'ok' : healthy === 0 ? 'bad' : 'warn'}>
              {healthy} of {health.length} adapters fresh
            </StatusPill>
            {unmonetisedClicks > 0 && (
              <StatusPill tone="warn">{unmonetisedClicks} unmonetised clicks</StatusPill>
            )}
          </>
        }
      />

      <main className={ADMIN_MAIN}>
        {/* The one alarm worth putting above everything else: if the cron has
            stopped, every number on the site is quietly going stale. */}
        {cronLooksDead && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-4 rounded-panel-lg bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,.35)] ring-1 ring-danger/25"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger-bg text-danger" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5">
                <path d="M12 8v5M12 16.5v.5M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>
            <p className="text-[15px] leading-relaxed text-ink-2">
              <b className="text-danger">The refresh has not run recently.</b>{' '}
              {lastRun
                ? `Last started ${ago(lastRun.startedAt)}. It should run ${refreshCadence()}.`
                : 'There is no record of it ever running.'}{' '}
              Check the Actions tab in GitHub — the schedule is best-effort and does stop.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clicks today" value={totals.today} footer={<Delta now={values[13]} before={values[12]} against="yesterday" />}>
            <MiniBars values={values.slice(7)} />
          </StatCard>
          <StatCard label="Last 7 days" value={totals.last7} footer={<Delta now={thisWeek} before={lastWeek} against="last week" />}>
            <MiniBars values={values.slice(7)} />
          </StatCard>
          <StatCard
            label="Last 30 days"
            value={totals.last30}
            footer={<span className="text-[12.5px] text-muted">{Math.round(totals.last30 / 30 * 10) / 10} a day on average</span>}
          />
          <StatCard
            label="Rate alerts"
            value={alerts.confirmed}
            footer={
              <span className="text-[12.5px] text-muted">
                {optIn === null ? 'None requested yet' : `${optIn}% of ${alerts.total} confirmed`}
              </span>
            }
          >
            {optIn !== null && (
              <span className="relative grid h-11 w-11 place-items-center" aria-hidden="true">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-line-2)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-bar)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(optIn / 100) * 94.2} 94.2`} />
                </svg>
              </span>
            )}
          </StatCard>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Panel
            title="Clicks, last 14 days"
            hint="Every click out to a provider, per day."
            action={
              <div className="text-end">
                <div className="font-display text-[26px] leading-none font-semibold tabular-nums">{fortnight}</div>
                <div className="mt-1 text-[12px] text-muted">in 14 days</div>
              </div>
            }
          >
            <ColumnChart data={days} caption="Clicks per day, last 14 days" unit="clicks" />
          </Panel>

          <Panel title="Clicks by provider" hint="Last 14 days, most first.">
            {providerBars.length === 0 ? (
              <Empty>No clicks recorded yet.</Empty>
            ) : (
              <BarList data={providerBars} caption="Clicks by provider, last 14 days" unit="clicks" />
            )}
          </Panel>
        </div>

        {unmonetisedClicks > 0 && (
          <div className="mt-4 flex items-center gap-4 rounded-panel-lg bg-gold-bg px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-on-gold" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4.5 w-4.5">
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
            </span>
            <p className="text-[14.5px] text-gold-dark">
              <b>{unmonetisedClicks} clicks</b> went to providers with no affiliate template set, so
              they earned nothing. Add the tracking URL on the{' '}
              <Link href="/admin/providers" className="font-semibold text-gold-dark underline underline-offset-2">
                providers page
              </Link>{' '}
              once each programme is approved.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Panel
            title="Adapter health"
            hint={`Captures in the last ${staleAfterPhrase()}, per provider.`}
            action={<span className="text-[13px] font-medium text-muted tabular-nums">{healthy}/{health.length} fresh</span>}
          >
            {health.length === 0 ? (
              <Empty>No providers configured.</Empty>
            ) : (
              <table className={TABLE}>
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Provider</th>
                    <th className={TH}>Last capture</th>
                    <th className={`${TH} text-right`}>Fresh</th>
                    <th className={`${TH} text-right`}>Stale</th>
                    <th className={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {health.map((row) => {
                    const tone = !row.lastCapture ? 'bad' : row.staleRows > 0 ? 'warn' : 'ok'
                    return (
                      <tr key={row.slug} className={TR}>
                        <td className={`${TD} font-medium text-ink`}>{row.provider}</td>
                        <td className={TD}>
                          <Dot tone={tone}>{ago(row.lastCapture)}</Dot>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>{row.freshRows}</td>
                        <td
                          className={`${TD} text-right tabular-nums ${row.staleRows > 0 ? 'font-semibold text-gold-dark' : 'text-faint'}`}
                        >
                          {row.staleRows}
                        </td>
                        <td className={`${TD} text-[13px] text-muted`}>{row.sources.join(', ') || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-4 rounded-[12px] bg-mist px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              A provider with no capture in {staleAfterPhrase()} is either disabled or its adapter is broken. A
              stale count above zero means the adapter failed and the previous quote was re-served.
            </p>
          </Panel>

          <Panel title="Recent cron runs" hint="Started, duration, and what failed.">
            {crons.length === 0 ? (
              <Empty>No runs recorded yet.</Empty>
            ) : (
              <table className={TABLE}>
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Started (PKT)</th>
                    <th className={`${TH} text-right`}>Quotes</th>
                    <th className={`${TH} text-right`}>OK</th>
                    <th className={`${TH} text-right`}>Failed</th>
                    <th className={TH}>Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {crons.map((run) => (
                    <tr key={run.id} className={TR}>
                      <td className={`${TD} font-medium text-ink tabular-nums`}>{PKT.format(run.startedAt)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{run.quotesWritten}</td>
                      <td className={`${TD} text-right tabular-nums text-ok`}>{run.adaptersOk}</td>
                      <td
                        className={`${TD} text-right tabular-nums ${run.adaptersFailed > 0 ? 'font-semibold text-gold-dark' : 'text-faint'}`}
                      >
                        {run.adaptersFailed}
                      </td>
                      <td className={`${TD} text-[13px] text-muted`}>
                        {run.finishedAt ? ago(run.finishedAt) : <Dot tone="bad">did not finish</Dot>}
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
                <table className={TABLE}>
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr className={THEAD_ROW}>
                      <th className={TH}>Day</th>
                      <th className={TH}>Provider</th>
                      <th className={TH}>Corridor</th>
                      <th className={`${TH} text-right`}>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((row, index) => (
                      <tr key={`${row.day}-${row.provider}-${row.corridor}-${index}`} className={TR}>
                        <td className={`${TD} tabular-nums text-muted`}>{row.day}</td>
                        <td className={`${TD} font-medium text-ink`}>{row.provider}</td>
                        <td className={`${TD} text-muted`}>{row.corridor ?? '—'}</td>
                        <td className={`${TD} text-right font-semibold tabular-nums`}>{row.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Rate alerts" hint="Volumes only — contact details are never shown here.">
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: alerts.confirmed, label: 'confirmed' },
                { value: alerts.awaitingConfirmation, label: 'awaiting opt-in' },
                { value: alerts.wantsDigest, label: 'want the digest' },
              ].map((item) => (
                <div key={item.label} className="rounded-[12px] bg-mist px-4 py-3">
                  <div className="font-display text-[24px] leading-none font-semibold tabular-nums">{item.value}</div>
                  <div className="mt-1.5 text-[12.5px] text-muted">{item.label}</div>
                </div>
              ))}
            </div>

            {alerts.byCurrency.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {alerts.byCurrency.map((row) => (
                  <span key={row.currency} className="rounded-full bg-icon-bg px-2.5 py-1 text-[12.5px] font-semibold text-ok tabular-nums">
                    {row.currency} {row.count}
                  </span>
                ))}
              </div>
            )}

            {alerts.recent.length === 0 ? (
              <div className="mt-4">
                <Empty>No alerts yet.</Empty>
              </div>
            ) : (
              <table className={`${TABLE} mt-4`}>
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Created (PKT)</th>
                    <th className={TH}>Channel</th>
                    <th className={TH}>Watching</th>
                    <th className={TH}>Opted in</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.recent.map((row, index) => (
                    <tr key={index} className={TR}>
                      <td className={`${TD} tabular-nums text-muted`}>{PKT.format(row.createdAt)}</td>
                      <td className={TD}>{row.channel}</td>
                      <td className={`${TD} tabular-nums`}>
                        {row.currency} {row.direction === 'above' ? '≥' : '≤'} {row.target.toFixed(2)}
                      </td>
                      <td className={TD}>
                        {row.confirmed ? <Dot tone="ok">yes</Dot> : <Dot tone="off">pending</Dot>}
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

/** A dashboard tile: the label, a large number, and a trend line beneath. */
function StatCard({
  label,
  value,
  footer,
  children,
}: {
  label: string
  value: number
  footer: React.ReactNode
  /** A small visual beside the number. */
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-panel-lg bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,.28)]">
      <div className="text-[13.5px] font-medium text-muted">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-display text-[38px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
          {value.toLocaleString('en-GB')}
        </div>
        {children}
      </div>
      <div className="mt-3">{footer}</div>
    </div>
  )
}
