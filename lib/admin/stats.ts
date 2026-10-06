/**
 * Admin dashboard queries.
 *
 * Deliberately raw SQL for the aggregates. These are grouped, date-bucketed
 * counts that the query builder expresses badly, and the dashboard is the one
 * place where reading the actual SQL matters — if the revenue numbers are
 * wrong, you want to see the GROUP BY.
 *
 * Everything here is read-only and every function degrades to an empty result
 * rather than throwing. A dashboard that 500s because one panel failed tells
 * you nothing about the other five.
 */
import { desc, gte, sql } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import {
  affiliateClicks,
  corridors,
  cronRuns,
  providers,
  rateAlerts,
  rateQuotes,
  siteStatsDaily,
} from '@/lib/db/schema'
import { utcDaysBack } from '@/lib/proof/events'

const DAY_MS = 86_400_000

/** Epoch milliseconds `days` days before now: the lower bound of a window. */
function msAgo(days: number): number {
  return Date.now() - days * DAY_MS
}

export interface ClicksByDay {
  day: string
  provider: string
  corridor: string | null
  clicks: number
}

/** Clicks grouped by day, provider and corridor — the revenue picture. */
export async function clicksByDay(days = 14): Promise<ClicksByDay[]> {
  try {
    return await db.all<ClicksByDay>(sql`
      SELECT
        date(${affiliateClicks.createdAt} / 1000, 'unixepoch') AS day,
        ${providers.name} AS provider,
        ${corridors.fromCountryName} AS corridor,
        count(*) AS clicks
      FROM ${affiliateClicks}
      INNER JOIN ${providers} ON ${providers.id} = ${affiliateClicks.providerId}
      LEFT JOIN ${corridors} ON ${corridors.id} = ${affiliateClicks.corridorId}
      WHERE ${affiliateClicks.createdAt} > ${msAgo(days)}
      GROUP BY day, provider, corridor
      ORDER BY day DESC, clicks DESC
    `)
  } catch (error) {
    console.error('[admin] clicksByDay failed:', error)
    return []
  }
}

export interface ClickTotals {
  today: number
  last7: number
  last30: number
  allTime: number
}

export async function clickTotals(): Promise<ClickTotals> {
  try {
    const now = new Date()
    const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const row = await db.get<ClickTotals | undefined>(sql`
      SELECT
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} >= ${startOfToday}) AS today,
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} > ${msAgo(7)})       AS last7,
        count(*) FILTER (WHERE ${affiliateClicks.createdAt} > ${msAgo(30)})      AS last30,
        count(*) AS "allTime"
      FROM ${affiliateClicks}
    `)

    return row ?? { today: 0, last7: 0, last30: 0, allTime: 0 }
  } catch (error) {
    console.error('[admin] clickTotals failed:', error)
    return { today: 0, last7: 0, last30: 0, allTime: 0 }
  }
}

export interface AlertStats {
  total: number
  confirmed: number
  awaitingConfirmation: number
  wantsDigest: number
  byChannel: { channel: string; count: number }[]
  byCurrency: { currency: string; count: number }[]
  recent: { createdAt: Date; channel: string; currency: string; target: number; direction: string; confirmed: boolean }[]
}

export async function alertStats(): Promise<AlertStats> {
  const empty: AlertStats = {
    total: 0,
    confirmed: 0,
    awaitingConfirmation: 0,
    wantsDigest: 0,
    byChannel: [],
    byCurrency: [],
    recent: [],
  }

  try {
    const rows = await db.select().from(rateAlerts).orderBy(desc(rateAlerts.createdAt))

    const countBy = <T extends string>(pick: (row: (typeof rows)[number]) => T) => {
      const map = new Map<T, number>()
      for (const row of rows) map.set(pick(row), (map.get(pick(row)) ?? 0) + 1)
      return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
    }

    return {
      total: rows.length,
      confirmed: rows.filter((r) => r.confirmed).length,
      awaitingConfirmation: rows.filter((r) => !r.confirmed).length,
      wantsDigest: rows.filter((r) => r.wantsDigest).length,
      byChannel: countBy((r) => r.channel).map(({ key, count }) => ({ channel: key, count })),
      byCurrency: countBy((r) => r.fromCurrency).map(({ key, count }) => ({
        currency: key,
        count,
      })),
      // Contact details are deliberately absent — the dashboard needs volumes,
      // not addresses, and not displaying them is the simplest way to keep them
      // out of a screenshot.
      recent: rows.slice(0, 15).map((r) => ({
        createdAt: r.createdAt,
        channel: r.channel,
        currency: r.fromCurrency,
        target: toNum(r.targetRate),
        direction: r.direction,
        confirmed: r.confirmed,
      })),
    }
  } catch (error) {
    console.error('[admin] alertStats failed:', error)
    return empty
  }
}

export interface AdapterHealth {
  provider: string
  slug: string
  lastCapture: Date | null
  staleRows: number
  freshRows: number
  sources: string[]
}

/**
 * Per-provider freshness.
 *
 * "Stale adapter" is the thing you most want to notice, and it is invisible on
 * the public site by design — a stale row still shows a number. This is where
 * it surfaces.
 */
export async function adapterHealth(windowHours = 24): Promise<AdapterHealth[]> {
  try {
    // The window is aggregated once and then joined, so the history is read
    // once rather than once per provider.
    const rows = await db.all<{
      provider: string
      slug: string
      lastCapture: number | null
      staleRows: number
      freshRows: number
      sources: string | null
    }>(sql`
      SELECT
        p.name AS provider,
        p.slug AS slug,
        q.last_capture AS "lastCapture",
        coalesce(q.stale_rows, 0) AS "staleRows",
        coalesce(q.fresh_rows, 0) AS "freshRows",
        q.sources AS sources
      FROM ${providers} AS p
      LEFT JOIN (
        SELECT
          provider_id,
          max(captured_at) AS last_capture,
          sum(stale) AS stale_rows,
          sum(1 - stale) AS fresh_rows,
          group_concat(DISTINCT source) AS sources
        FROM ${rateQuotes}
        WHERE captured_at > ${Date.now() - windowHours * 3_600_000}
        GROUP BY provider_id
      ) AS q ON q.provider_id = p.id
      WHERE p.active = 1 AND p.is_benchmark = 0
      ORDER BY p.name
    `)

    return rows.map((row) => ({
      ...row,
      lastCapture: row.lastCapture === null ? null : new Date(row.lastCapture),
      // group_concat gives null for a provider with no rows in the window.
      sources: row.sources ? row.sources.split(',') : [],
    }))
  } catch (error) {
    console.error('[admin] adapterHealth failed:', error)
    return []
  }
}

/** Most recent cron runs, so a silently dead GitHub schedule is visible. */
export async function recentCronRuns(limit = 8) {
  try {
    return await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(limit)
  } catch (error) {
    console.error('[admin] recentCronRuns failed:', error)
    return []
  }
}

/** Providers with their monetisation config, for the affiliate settings page. */
export async function providerSettings() {
  try {
    return await db
      .select({
        id: providers.id,
        slug: providers.slug,
        name: providers.name,
        homepageUrl: providers.homepageUrl,
        affiliateNetwork: providers.affiliateNetwork,
        affiliateUrlTemplate: providers.affiliateUrlTemplate,
        commissionNote: providers.commissionNote,
        featured: providers.featured,
        isBenchmark: providers.isBenchmark,
        active: providers.active,
      })
      .from(providers)
      .orderBy(providers.name)
  } catch (error) {
    console.error('[admin] providerSettings failed:', error)
    return []
  }
}

/** Clicks per provider that would earn commission versus those that cannot. */
export async function monetisationGap() {
  try {
    const rows = await db.all<{ provider: string; monetised: number; clicks: number }>(sql`
      SELECT
        ${providers.name} AS provider,
        ${providers.affiliateUrlTemplate} IS NOT NULL AS monetised,
        count(${affiliateClicks.id}) AS clicks
      FROM ${providers}
      LEFT JOIN ${affiliateClicks} ON ${affiliateClicks.providerId} = ${providers.id}
      WHERE ${providers.active} = 1 AND ${providers.isBenchmark} = 0
      GROUP BY ${providers.id}
      ORDER BY clicks DESC
    `)

    // SQLite has no boolean type: IS NOT NULL comes back as 0 or 1.
    return rows.map((row) => ({ ...row, monetised: row.monetised === 1 }))
  } catch (error) {
    console.error('[admin] monetisationGap failed:', error)
    return []
  }
}

export interface ProofDay {
  date: string
  comparisonsRun: number
  clicks: number
  savingPkrTotal: number
  bestProviderChanges: number
}

/**
 * The daily proof series for the admin chart.
 *
 * Reads `site_stats_daily` rather than aggregating the raw tables, so the chart
 * and the public claims are looking at the same rollup. A day with no row is
 * returned as zeroes rather than skipped, otherwise the chart would compress
 * quiet days out of existence and misrepresent the shape.
 */
export async function proofByDay(days = 30): Promise<ProofDay[]> {
  try {
    const dates = utcDaysBack(days)
    const rows = await db
      .select()
      .from(siteStatsDaily)
      .where(gte(siteStatsDaily.date, dates[0]))
    const byDate = new Map(rows.map((row) => [row.date, row]))

    return dates.map((date) => {
      const row = byDate.get(date)
      return {
        date,
        comparisonsRun: row?.comparisonsRun ?? 0,
        clicks: row?.clicks ?? 0,
        savingPkrTotal: toNum(row?.savingPkrTotal),
        bestProviderChanges: row?.bestProviderChanges ?? 0,
      }
    })
  } catch (error) {
    console.error('[admin] proofByDay failed:', error)
    return []
  }
}
