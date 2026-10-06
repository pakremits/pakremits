/**
 * Read every query family once against the bound D1 and print a summary.
 *
 * A quick look after a seed or refresh, and the smoke test for a database
 * port: each line exercises a different kind of query (latest-quote join,
 * daily series, admin aggregates, proof rollups).
 *
 *   npm run db:check                    # local D1
 *   D1_TARGET=remote npm run db:check   # the real database
 */
import '../lib/load-env'
import { adapterHealth, clickTotals, monetisationGap, proofByDay, recentCronRuns } from '../lib/admin/stats'
import { connectNodeD1 } from '../lib/db/node'
import { getProofStats } from '../lib/proof/stats'
import { getBestRatePerCorridor, getComparison, getMidMarketHistory } from '../lib/quotes'

async function main() {
  const d1 = await connectNodeD1()
  console.log(`D1: ${d1.target}\n`)

  const comparison = await getComparison({ corridorSlug: 'uk', amount: 500 })
  if (!comparison || comparison.unavailable) throw new Error('comparison for uk is unavailable')
  console.log(`uk/bank @ £${comparison.amount}: ${comparison.rows.length} rows, mid ${comparison.midMarketRate}`)
  for (const row of comparison.rows.slice(0, 5)) {
    console.log(
      `  ${row.isBest ? '*' : ' '} ${row.quote.providerName.padEnd(22)} ${row.quote.rate.toFixed(4)}  fee ${row.quote.fee}  → ₨ ${row.quote.amountReceived}`,
    )
  }
  console.log(`  saving vs bank: ${comparison.savingVsBank}, captured ${comparison.capturedAt?.toISOString()}`)

  const best = await getBestRatePerCorridor()
  console.log(`\nbest rate per corridor: ${best.map((c) => `${c.slug} ${c.bestRate ?? '—'}`).join(', ')}`)

  const history = await getMidMarketHistory('GBP', 90)
  const first = history.daily.at(0)
  const last = history.daily.at(-1)
  console.log(
    `\nGBP history: ${history.daily.length} daily points (${first && new Date(first.t).toISOString().slice(0, 10)} → ${last && new Date(last.t).toISOString().slice(0, 10)}), ${history.intraday.length} intraday`,
  )

  const health = await adapterHealth()
  console.log(`\nadapter health: ${health.map((h) => `${h.slug} ${h.freshRows}/${h.staleRows} [${h.sources.join(',')}]`).join('; ')}`)
  console.log('click totals:', await clickTotals())
  console.log('monetisation gap rows:', (await monetisationGap()).length)
  const days = await proofByDay(3)
  console.log('proof by day:', days.map((d) => `${d.date}:${d.comparisonsRun}/${d.clicks}/${d.savingPkrTotal}/${d.bestProviderChanges}`).join(' '))
  const runs = await recentCronRuns(1)
  console.log('last run:', runs[0] ? `${runs[0].job} ${runs[0].startedAt.toISOString()} → ${runs[0].finishedAt?.toISOString()} wrote ${runs[0].quotesWritten}` : 'none')
  const stats = await getProofStats({ fresh: true })
  console.log('proof stats:', { ...stats, computedAt: stats.computedAt.toISOString() })

  if (d1.target === 'remote') console.log(`\nD1 API requests: ${d1.requests()}`)
  await d1.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
