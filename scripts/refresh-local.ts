/**
 * The scheduled refresh.
 *
 * This is what the scheduled GitHub Actions job runs against the real database
 * (D1_TARGET=remote), and what you run locally after seeding. It calls the
 * same `runFullRefresh` as the HTTP route, so the /admin run history is
 * identical either way.
 *
 *   npm run refresh
 */
import '../lib/load-env'
import { runFullRefresh } from '../lib/cron/run'
import { connectNodeD1 } from '../lib/db/node'

async function main() {
  const d1 = await connectNodeD1()
  console.log(`Refreshing (${d1.target} D1)…`)
  const result = await runFullRefresh('refresh-rates')

  console.log(`\n  mid-market: ${result.midMarket.written}/8 currencies`)
  for (const failure of result.midMarket.failed) console.log(`    ! ${failure}`)

  console.log(`\n  quotes written: ${result.quotes.quotesWritten}`)
  console.log(`  adapters ok:    ${result.quotes.adaptersOk}`)
  console.log(`  adapters failed:${result.quotes.adaptersFailed}`)
  console.log(`  stale served:   ${result.quotes.staleServed}`)
  console.log(`  stale dropped:  ${result.quotes.staleDropped}`)
  console.log(`  pruned quotes:  ${result.prunedQuotes}`)
  for (const error of result.quotes.writeErrors) console.log(`    ! write ${error}`)

  if (result.alerts) {
    console.log(
      `\n  alerts: ${result.alerts.fired} fired, ${result.alerts.digestsSent} digests, ` +
        `${result.alerts.failed} failed, of ${result.alerts.considered} considered`,
    )
    for (const [reason, count] of Object.entries(result.alerts.skipped)) {
      console.log(`    skipped ${reason}: ${count}`)
    }
  }

  console.log(`\n  duration: ${(result.durationMs / 1000).toFixed(1)}s  (run #${result.runId})`)
  if (d1.target === 'remote') console.log(`  D1 API requests: ${d1.requests()}`)

  if (result.quotes.failures.length > 0) {
    console.log('\n  Failures:')
    for (const failure of result.quotes.failures.slice(0, 20)) {
      console.log(`    ${failure.provider} ${failure.corridor}/${failure.method}: ${failure.error}`)
    }
    if (result.quotes.failures.length > 20) {
      console.log(`    …and ${result.quotes.failures.length - 20} more`)
    }
  }

  await d1.close()
  // A failed write lost a corridor's quotes: the job should go red.
  process.exit(result.quotes.writeErrors.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
