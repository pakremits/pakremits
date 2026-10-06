/**
 * Seed synthetic proof data, to check the thresholds actually flip.
 *
 * This exists for the acceptance check in the brief: a fresh deploy shows only
 * the day-one lines, and after 1,000 comparison events and ₨ 30 lakh of ledger
 * savings the month and savings lines appear on their own.
 *
 * It refuses to run against the remote database, because writing fake rows
 * into the savings ledger would corrupt the one number on the site that is
 * supposed to be beyond question.
 *
 *   npx tsx scripts/seed-proof-demo.ts          # seed
 *   npx tsx scripts/seed-proof-demo.ts --clear  # remove everything it wrote
 */
import '../lib/load-env'
import { randomUUID } from 'node:crypto'
import { desc, eq, like } from 'drizzle-orm'
import { db, runBatch } from '../lib/db'
import { connectNodeD1 } from '../lib/db/node'
import {
  affiliateClicks,
  comparisonEvents,
  corridors,
  providers,
  savingsLedger,
} from '../lib/db/schema'
import { rollUpSiteStats } from '../lib/proof/events'
import { getProofStats } from '../lib/proof/stats'
import { LAUNCH_DATE, THRESHOLDS } from '../lib/proof/config'
import { formatProofPkrFull } from '../lib/proof/format'

/** Marks every row this script writes, so --clear can find them again. */
const DEMO_UTM = 'utm_source=proof-demo'
const DEMO_SESSION_PREFIX = 'proof-demo-'

const COMPARISONS = 1_000
const TARGET_SAVINGS = 3_000_000
const CLICKS = 300

/** Rows per event insert: 4 columns each, under D1's 100 bound parameters. */
const EVENT_ROWS_PER_INSERT = 25

async function assertNotProduction() {
  const local = (process.env.D1_TARGET || 'local') === 'local'

  if (!local && process.env.PROOF_DEMO_ALLOW_REMOTE !== '1') {
    console.error(
      'Refusing to run: D1_TARGET is not local.\n' +
        'This writes fake rows into savings_ledger, which is the source of the\n' +
        'public savings figure. Set PROOF_DEMO_ALLOW_REMOTE=1 only if you are\n' +
        'certain this is a throwaway database.',
    )
    process.exit(1)
  }
}

async function clear() {
  // The ledger cascades from affiliate_clicks, so deleting the clicks is enough.
  const clicks = await db
    .delete(affiliateClicks)
    .where(eq(affiliateClicks.utm, DEMO_UTM))
    .returning({ id: affiliateClicks.id })

  const events = await db
    .delete(comparisonEvents)
    .where(like(comparisonEvents.sessionId, `${DEMO_SESSION_PREFIX}%`))
    .returning({ id: comparisonEvents.id })

  await rollUpSiteStats(40)

  console.log(`Removed ${clicks.length} demo clicks and ${events.length} demo events.`)
}

async function seed() {
  const [corridor] = await db.select().from(corridors).where(eq(corridors.active, true)).limit(1)
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.active, true))
    .orderBy(desc(providers.id))
    .limit(1)

  if (!corridor || !provider) {
    console.error('Seed the providers and corridors first: npm run seed')
    process.exit(1)
  }

  /*
    Both series have to land inside the window the stats actually count:
    `savingsSinceLaunch` filters on LAUNCH_DATE and the monthly counters filter
    on the first of the month. Spreading rows backwards by a fixed interval put
    most of them before launch, so the ledger summed to a tenth of the target.
    Spread across the available window instead, whatever its width.
  */
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const windowStart = new Date(Math.max(LAUNCH_DATE.getTime(), monthStart.getTime()))
  const windowMs = Math.max(now.getTime() - windowStart.getTime(), 60_000)

  const spread = (index: number, count: number) =>
    new Date(now.getTime() - Math.floor((windowMs * index) / count))
  const eventRows = Array.from({ length: COMPARISONS }, (_, i) => {
    const bucket = spread(i, COMPARISONS)
    bucket.setSeconds(0, 0)
    return {
      sessionId: `${DEMO_SESSION_PREFIX}${i}`,
      minuteBucket: bucket,
      corridorId: corridor.id,
      createdAt: bucket,
    }
  })

  const eventInserts = []
  for (let i = 0; i < eventRows.length; i += EVENT_ROWS_PER_INSERT) {
    eventInserts.push(
      db
        .insert(comparisonEvents)
        .values(eventRows.slice(i, i + EVENT_ROWS_PER_INSERT))
        .onConflictDoNothing(),
    )
  }
  await runBatch(eventInserts)

  // Clicks with ledger rows summing to the target.
  const perClick = Math.round((TARGET_SAVINGS / CLICKS) * 100) / 100

  for (let i = 0; i < CLICKS; i += 1) {
    const createdAt = spread(i, CLICKS)

    const [click] = await db
      .insert(affiliateClicks)
      .values({
        providerId: provider.id,
        corridorId: corridor.id,
        amountSent: 500,
        deliveryMethod: 'bank',
        clickId: randomUUID(),
        utm: DEMO_UTM,
        createdAt,
      })
      .returning({ id: affiliateClicks.id })

    if (!click) continue

    await db.insert(savingsLedger).values({
      affiliateClickId: click.id,
      corridorId: corridor.id,
      providerId: provider.id,
      amountSent: 500,
      providerReceivedPkr: 187_500,
      bankReceivedPkr: 187_500 - perClick,
      savingPkr: perClick,
      createdAt,
    })
  }

  await rollUpSiteStats(40)
  console.log(`Wrote ${COMPARISONS} comparison events and ${CLICKS} clicks.`)
}

async function report() {
  const stats = await getProofStats({ fresh: true })

  const line = (label: string, value: string, met: boolean) =>
    `  ${met ? 'shown ' : 'hidden'}  ${label.padEnd(28)} ${value}`

  console.log('\nProof stats now:')
  console.log(
    line(
      'savings since launch',
      formatProofPkrFull(stats.savingsSinceLaunch),
      stats.savingsSinceLaunch >= THRESHOLDS.savingsSinceLaunch,
    ),
  )
  console.log(
    line(
      'comparisons this month',
      String(stats.comparisonsThisMonth),
      stats.comparisonsThisMonth >= THRESHOLDS.comparisonsThisMonth,
    ),
  )
  console.log(`  always   ${'providers compared'.padEnd(28)} ${stats.providersCompared}`)
  console.log(`  always   ${'refresh minutes'.padEnd(28)} ${stats.refreshMinutes}`)
  console.log()
}

async function main() {
  await assertNotProduction()
  const d1 = await connectNodeD1()

  if (process.argv.includes('--clear')) {
    await clear()
  } else {
    await seed()
  }

  await report()
  await d1.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
