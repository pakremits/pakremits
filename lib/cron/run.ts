/**
 * The full refresh, as one function.
 *
 * Previously the HTTP route and the `npm run refresh` script each did their own
 * thing, and only the route recorded a `cron_runs` row. Since the GitHub
 * Actions job runs the script — the HTTP route cannot, because a full refresh
 * takes about four minutes against a 60s function limit — nothing in
 * production was ever writing a run record, and the /admin dashboard would
 * have shown "the refresh has not run recently" permanently while the refresh
 * ran perfectly every 15 minutes.
 *
 * One implementation, both callers, one place that records the run.
 */
import { eq } from 'drizzle-orm'
import { db, toRate } from '@/lib/db'
import { type SendCurrency, cronRuns, midMarketRates } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { getMidMarketRate } from '@/lib/fx'
import { pruneOldQuotes, refreshAllRates } from '@/lib/providers/refresh'
import { evaluateAlerts, pruneUnconfirmedAlerts } from '@/lib/alerts/evaluate'
import { refreshBenchmarks } from '@/lib/proof/benchmarks'
import { pruneComparisonEvents, rollUpSiteStats } from '@/lib/proof/events'
import { detectLeaderChanges } from '@/lib/proof/leaders'
import { invalidateProofStats } from '@/lib/proof/stats'

export interface FullRefreshResult {
  runId: number | null
  midMarket: { written: number; failed: string[] }
  quotes: Awaited<ReturnType<typeof refreshAllRates>>
  prunedQuotes: number
  alerts: Awaited<ReturnType<typeof evaluateAlerts>> | null
  prunedUnconfirmedAlerts: number
  proof: {
    benchmarksWritten: number
    benchmarksPinned: number
    leaderChanges: number
    statsDaysRolled: number
    prunedEvents: number
  }
  durationMs: number
}

/**
 * Refresh the mid-market line for all eight currencies: fetched in parallel,
 * written in one insert.
 */
async function refreshMidMarket(): Promise<{
  written: number
  failed: string[]
  rates: Map<SendCurrency, number>
}> {
  const failed: string[] = []
  const fetched = await Promise.all(
    CORRIDORS.map(async (corridor) => {
      try {
        return await getMidMarketRate(corridor.fromCurrency)
      } catch (error) {
        failed.push(
          `${corridor.fromCurrency}: ${error instanceof Error ? error.message : String(error)}`,
        )
        return null
      }
    }),
  )
  const rows = fetched.filter((rate) => rate !== null)
  const rates = new Map<SendCurrency, number>()
  if (rows.length === 0) return { written: 0, failed, rates }

  try {
    await db.insert(midMarketRates).values(
      rows.map((rate) => ({
        fromCurrency: rate.fromCurrency,
        toCurrency: 'PKR',
        rate: toRate(rate.rate),
        capturedAt: rate.capturedAt,
        source: rate.source,
      })),
    )
  } catch (error) {
    failed.push(`write: ${error instanceof Error ? error.message : String(error)}`)
    return { written: 0, failed, rates }
  }

  for (const rate of rows) rates.set(rate.fromCurrency, rate.rate)
  return { written: rows.length, failed, rates }
}

/**
 * Run everything: mid-market, provider quotes, pruning, then alerts.
 *
 * `job` distinguishes the scheduled run from a manual trigger in the /admin
 * history, which matters when you are trying to work out whether the schedule
 * is alive or someone was poking it by hand.
 */
export async function runFullRefresh(job = 'refresh-rates'): Promise<FullRefreshResult> {
  const started = Date.now()

  // Recorded up front so a run that dies halfway still leaves evidence it
  // started — an unfinished row is far more diagnostic than a missing one.
  let runId: number | null = null
  try {
    const [run] = await db.insert(cronRuns).values({ job }).returning()
    runId = run?.id ?? null
  } catch (error) {
    console.error('[cron] could not record run start:', error)
  }

  // Mid-market first: if a provider adapter dies mid-run we still have a fresh
  // reference line for the ticker and the corridor charts.
  const midMarket = await refreshMidMarket()
  const quotes = await refreshAllRates()
  const prunedQuotes = await pruneOldQuotes()

  // Alerts last, so they trigger on the rates this run just wrote. A failure
  // here is a warning: losing an alert must not lose the refresh.
  let alerts: FullRefreshResult['alerts'] = null
  let prunedUnconfirmedAlerts = 0
  try {
    alerts = await evaluateAlerts()
    prunedUnconfirmedAlerts = await pruneUnconfirmedAlerts()
  } catch (error) {
    console.error('[cron] alert evaluation failed:', error)
  }

  /**
   * Proof layer. Runs after the quotes are written so the leader comparison
   * sees this pass's rankings, and every step is individually guarded: a
   * failure here must not mark an otherwise healthy refresh as failed.
   */
  const proof = {
    benchmarksWritten: 0,
    benchmarksPinned: 0,
    leaderChanges: 0,
    statsDaysRolled: 0,
    prunedEvents: 0,
  }

  try {
    const benchmarks = await refreshBenchmarks(midMarket.rates)
    proof.benchmarksWritten = benchmarks.written
    proof.benchmarksPinned = benchmarks.skippedPinned

    proof.leaderChanges = (await detectLeaderChanges()).length
    proof.statsDaysRolled = await rollUpSiteStats()
    proof.prunedEvents = await pruneComparisonEvents()

    // The memo would otherwise keep serving pre-refresh numbers to anything
    // in this process that reads them after the run.
    invalidateProofStats()
  } catch (error) {
    console.error('[cron] proof layer failed:', error)
  }

  const durationMs = Date.now() - started

  if (runId !== null) {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        quotesWritten: quotes.quotesWritten,
        adaptersOk: quotes.adaptersOk,
        adaptersFailed: quotes.adaptersFailed,
        error:
          quotes.failures.length > 0 || quotes.writeErrors.length > 0
            ? JSON.stringify([...quotes.writeErrors, ...quotes.failures].slice(0, 20))
            : null,
      })
      .where(eq(cronRuns.id, runId))
      .catch((error) => console.error('[cron] could not record run finish:', error))
  }

  return {
    runId,
    midMarket,
    quotes,
    prunedQuotes,
    alerts,
    prunedUnconfirmedAlerts,
    proof,
    durationMs,
  }
}
