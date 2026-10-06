/**
 * Print the proof stats and which claims they make visible.
 *
 * Used to verify the acceptance criteria by hand: run it on an empty database,
 * then after scripts/seed-proof-demo.ts, and compare.
 */
import '../lib/load-env'
import { connectNodeD1 } from '../lib/db/node'
import { evaluateClaims } from '../lib/proof/claims'
import { formatProofPkrFull } from '../lib/proof/format'
import { getProofStats } from '../lib/proof/stats'

async function main() {
  const d1 = await connectNodeD1()
  const stats = await getProofStats({ fresh: true })

  console.log('savingsSinceLaunch      ', formatProofPkrFull(stats.savingsSinceLaunch))
  console.log('savingsThisMonth        ', formatProofPkrFull(stats.savingsThisMonth))
  console.log('comparisonsThisMonth    ', stats.comparisonsThisMonth)
  console.log('bestProviderChanges     ', stats.bestProviderChangesThisMonth)
  console.log('providersCompared       ', stats.providersCompared)
  console.log('refreshMinutes          ', stats.refreshMinutes)
  console.log()

  for (const claim of evaluateClaims({ stats, liveGapOnStandardAmount: 1500 })) {
    console.log(`${claim.visible ? 'SHOWN ' : 'hidden'}  ${claim.id.padEnd(24)} ${claim.reason}`)
  }

  await d1.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
