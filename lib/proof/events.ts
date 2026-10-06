/**
 * Comparison-run events, and the daily rollup that feeds the admin chart.
 */
import { type AnyColumn, and, count, gte, isNotNull, lt, sql, sum } from 'drizzle-orm'
import { db, runBatch, toMoney, toNum } from '@/lib/db'
import { rowsChanged } from '@/lib/db/d1'
import { affiliateClicks, comparisonEvents, savingsLedger, siteStatsDaily } from '@/lib/db/schema'

/** Name of the opaque session cookie. No personal data, no cross-site value. */
export const SESSION_COOKIE = 'prq_sid'

/** How long comparison events are kept before the rollup makes them redundant. */
const EVENT_RETENTION_DAYS = 45

/**
 * Record that the comparison widget fetched quotes, once per session per minute.
 *
 * The dedup is a unique index on (session, minute) with ON CONFLICT DO NOTHING,
 * not a read-then-write. Someone dragging the amount slider fires several
 * requests within the same second; two of them racing would both pass a
 * "have we seen this session this minute?" SELECT and insert twice. Letting
 * the database enforce it is the only version that is actually correct under
 * concurrency, and it is one round trip instead of two.
 */
export async function recordComparisonRun(
  sessionId: string,
  corridorId: number | null,
): Promise<void> {
  try {
    const minuteBucket = new Date()
    minuteBucket.setSeconds(0, 0)

    await db
      .insert(comparisonEvents)
      .values({ sessionId, minuteBucket, corridorId })
      .onConflictDoNothing({
        target: [comparisonEvents.sessionId, comparisonEvents.minuteBucket],
      })
  } catch (error) {
    // Analytics must never break a quote response.
    console.error('[proof] recordComparisonRun failed:', error)
  }
}

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` in UTC, the format of `site_stats_daily.date`. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The UTC days from `days` days ago up to today, oldest first. */
export function utcDaysBack(days: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: days + 1 }, (_, i) => utcDay(new Date(today - (days - i) * DAY_MS)))
}

/** The UTC calendar day of an epoch-milliseconds column. */
function dayOf(column: AnyColumn) {
  return sql<string>`date(${column} / 1000, 'unixepoch')`
}

/**
 * Rebuild `site_stats_daily` for the last `days` days.
 *
 * Idempotent: a full recompute per day rather than an increment, so running it
 * twice — or after a partial cron failure — converges on the same numbers
 * instead of double-counting. `best_provider_changes` is the exception, since
 * it is an event counted at detection time and cannot be recomputed from
 * current state; it is incremented in place and preserved here.
 */
export async function rollUpSiteStats(days = 3): Promise<number> {
  try {
    const dates = utcDaysBack(days)
    const since = new Date(`${dates[0]}T00:00:00Z`)

    const eventDay = dayOf(comparisonEvents.createdAt)
    const clickDay = dayOf(affiliateClicks.createdAt)
    const savingDay = dayOf(savingsLedger.createdAt)

    const [events, clicks, savings] = await Promise.all([
      db
        .select({ day: eventDay, n: count() })
        .from(comparisonEvents)
        .where(gte(comparisonEvents.createdAt, since))
        .groupBy(eventDay),
      db
        .select({ day: clickDay, n: count() })
        .from(affiliateClicks)
        .where(gte(affiliateClicks.createdAt, since))
        .groupBy(clickDay),
      db
        .select({ day: savingDay, total: sum(savingsLedger.savingPkr) })
        .from(savingsLedger)
        .where(and(gte(savingsLedger.createdAt, since), isNotNull(savingsLedger.savingPkr)))
        .groupBy(savingDay),
    ])

    const byDay = <T extends { day: string }>(rows: T[]) => new Map(rows.map((row) => [row.day, row]))
    const eventsByDay = byDay(events)
    const clicksByDay = byDay(clicks)
    const savingsByDay = byDay(savings)

    await runBatch(
      dates.map((date) => {
        const row = {
          date,
          comparisonsRun: eventsByDay.get(date)?.n ?? 0,
          clicks: clicksByDay.get(date)?.n ?? 0,
          savingPkrTotal: toMoney(toNum(savingsByDay.get(date)?.total)),
        }
        return db
          .insert(siteStatsDaily)
          .values({ ...row, bestProviderChanges: 0 })
          .onConflictDoUpdate({
            target: siteStatsDaily.date,
            set: {
              comparisonsRun: row.comparisonsRun,
              clicks: row.clicks,
              savingPkrTotal: row.savingPkrTotal,
            },
          })
      }),
    )

    return dates.length
  } catch (error) {
    console.error('[proof] rollUpSiteStats failed:', error)
    return 0
  }
}

/** Count a change of top-ranked provider against today's row. */
export async function recordBestProviderChange(changes = 1): Promise<void> {
  if (changes <= 0) return

  try {
    await db
      .insert(siteStatsDaily)
      .values({ date: utcDay(new Date()), bestProviderChanges: changes })
      .onConflictDoUpdate({
        target: siteStatsDaily.date,
        set: {
          bestProviderChanges: sql`${siteStatsDaily.bestProviderChanges} + excluded.best_provider_changes`,
        },
      })
  } catch (error) {
    console.error('[proof] recordBestProviderChange failed:', error)
  }
}

/** Drop comparison events the rollup has already absorbed. */
export async function pruneComparisonEvents(days = EVENT_RETENTION_DAYS): Promise<number> {
  try {
    const result = await db
      .delete(comparisonEvents)
      .where(lt(comparisonEvents.createdAt, new Date(Date.now() - days * DAY_MS)))
      .run()

    return rowsChanged(result)
  } catch (error) {
    console.error('[proof] pruneComparisonEvents failed:', error)
    return 0
  }
}
