/**
 * "The best rate changed hands N times" — detection.
 *
 * A change of leader is a transition between two refreshes, so it cannot be
 * recomputed from the current rate table afterwards. Each pass compares the
 * newly ranked top provider per corridor against `corridor_leaders`, counts the
 * differences, and overwrites the row.
 *
 * Only the `bank` rail at each corridor's default amount is tracked. Counting
 * every rail and every amount would inflate the number into meaninglessness —
 * a wallet-only reshuffle at 100 GBP is not "the best rate changing hands".
 */
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { corridorLeaders, corridors, providers } from '@/lib/db/schema'
import { defaultAmountFor } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'
import { recordBestProviderChange } from './events'

export interface LeaderChange {
  corridorSlug: string
  from: string | null
  to: string
}

/** Compare the current leaders against the stored ones and count the moves. */
export async function detectLeaderChanges(): Promise<LeaderChange[]> {
  const changes: LeaderChange[] = []

  try {
    const [corridorRows, existing, providerRows] = await Promise.all([
      db.select().from(corridors).where(eq(corridors.active, true)),
      db.select().from(corridorLeaders),
      db.select({ id: providers.id, slug: providers.slug }).from(providers),
    ])
    const previousByCorridor = new Map(existing.map((row) => [row.corridorId, row.providerId]))
    const providerIdBySlug = new Map(providerRows.map((row) => [row.slug, row.id]))

    for (const corridor of corridorRows) {
      const comparison = await getComparison({
        corridorSlug: corridor.slug,
        method: 'bank',
        amount: defaultAmountFor(corridor.fromCurrency),
        includeBenchmark: false,
      })

      const winner = comparison?.rows.find((row) => row.isBest)
      if (!winner) continue

      const providerId = providerIdBySlug.get(winner.quote.providerSlug)
      if (providerId === undefined) continue

      const previous = previousByCorridor.get(corridor.id)

      // A corridor we have never seen has no "previous best", so its first
      // observation is a baseline, not a change. Counting it would show a burst
      // of changes on the first run after deploy that never actually happened.
      if (previous !== undefined && previous !== providerId) {
        changes.push({
          corridorSlug: corridor.slug,
          from: existing.find((r) => r.corridorId === corridor.id)?.providerId
            ? String(previous)
            : null,
          to: winner.quote.providerSlug,
        })
      }

      if (previous !== providerId) {
        await db
          .insert(corridorLeaders)
          .values({ corridorId: corridor.id, providerId, since: new Date() })
          .onConflictDoUpdate({
            target: corridorLeaders.corridorId,
            set: { providerId, since: new Date() },
          })
      }
    }

    await recordBestProviderChange(changes.length)
  } catch (error) {
    console.error('[proof] detectLeaderChanges failed:', error)
  }

  return changes
}
