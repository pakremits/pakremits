/**
 * getProofStats — every number behind a trust claim, in one query pass.
 *
 * The contract this file exists to keep: nothing returned here is a constant, a
 * projection, or a rounded-up figure. Each field is a SUM or COUNT over a table
 * that only real activity writes to. When there is no data the field is 0 or
 * null and the claim that depends on it does not render.
 */
import { and, count, eq, gte, isNotNull, sql, sum } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import { providers, savingsLedger, siteStatsDaily } from '@/lib/db/schema'
import { REFRESH_INTERVAL_MINUTES } from '@/lib/cadence'
import { IN_STATIC_BUILD } from '@/lib/build-phase'
import { LAUNCH_DATE, PROOF_CACHE_MS } from './config'

export interface ProofStats {
  savingsSinceLaunch: number
  savingsThisMonth: number
  comparisonsThisMonth: number
  bestProviderChangesThisMonth: number
  providersCompared: number
  refreshMinutes: number
  /** Null when the database was unreachable — distinct from a genuine zero. */
  unavailable?: boolean
  /** When this snapshot was computed, for the "as of" line in /admin. */
  computedAt: Date
}

const EMPTY: ProofStats = {
  savingsSinceLaunch: 0,
  savingsThisMonth: 0,
  comparisonsThisMonth: 0,
  bestProviderChangesThisMonth: 0,
  providersCompared: 0,
  refreshMinutes: REFRESH_INTERVAL_MINUTES,
  unavailable: true,
  computedAt: new Date(0),
}

/**
 * Five-minute memo, per process: the static build renders several pages that
 * show these figures, and they need only one read.
 */
let cached: { value: ProofStats; expires: number } | null = null

/** First day of the current month, UTC. */
function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** `YYYY-MM-DD`, for comparing against `site_stats_daily.date` — a text column. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getProofStats(options?: { fresh?: boolean }): Promise<ProofStats> {
  if (!options?.fresh && cached && cached.expires > Date.now()) return cached.value

  try {
    const since = monthStart()

    const [savings, monthly, monthCounters, providerCount] = await Promise.all([
      // Since launch. `saving_pkr IS NOT NULL` drops clicks in corridors that
      // had no benchmark, which is the whole reason the column is nullable.
      db
        .select({ total: sum(savingsLedger.savingPkr) })
        .from(savingsLedger)
        .where(
          and(isNotNull(savingsLedger.savingPkr), gte(savingsLedger.createdAt, LAUNCH_DATE)),
        ),

      db
        .select({ total: sum(savingsLedger.savingPkr) })
        .from(savingsLedger)
        .where(and(isNotNull(savingsLedger.savingPkr), gte(savingsLedger.createdAt, since))),

      // Comparisons and leader changes come from the daily rollup rather than
      // the raw event table: the rollup is what /admin charts, and reading the
      // same source keeps the hero and the dashboard from disagreeing.
      db
        .select({
          comparisons: sql<number>`coalesce(sum(${siteStatsDaily.comparisonsRun}), 0)`,
          changes: sql<number>`coalesce(sum(${siteStatsDaily.bestProviderChanges}), 0)`,
        })
        .from(siteStatsDaily)
        .where(gte(siteStatsDaily.date, isoDay(since))),

      db
        .select({ n: count() })
        .from(providers)
        .where(and(eq(providers.active, true), eq(providers.isBenchmark, false))),
    ])

    const counters = monthCounters[0]

    const value: ProofStats = {
      savingsSinceLaunch: toNum(savings[0]?.total ?? 0),
      savingsThisMonth: toNum(monthly[0]?.total ?? 0),
      comparisonsThisMonth: counters?.comparisons ?? 0,
      bestProviderChangesThisMonth: counters?.changes ?? 0,
      providersCompared: providerCount[0]?.n ?? 0,
      refreshMinutes: REFRESH_INTERVAL_MINUTES,
      computedAt: new Date(),
    }

    cached = { value, expires: Date.now() + PROOF_CACHE_MS }
    return value
  } catch (error) {
    // In the static build a failed read fails the build: zeroes would hide
    // every claim until the next deploy.
    if (IN_STATIC_BUILD) throw error
    // Elsewhere a dead database must not take the caller with it. Every claim
    // is threshold-gated on these numbers, and zeroes hide all of them — which
    // is the correct failure mode: show no proof rather than a wrong one.
    console.error('[proof] getProofStats failed:', error)
    return EMPTY
  }
}

/** Drop the memo, so a refresh in the same process shows through. */
export function invalidateProofStats(): void {
  cached = null
}
