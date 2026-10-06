/**
 * Rate limits that hold across Worker isolates, counted in D1.
 *
 * A Worker runs in many isolates at once, so an in-memory counter
 * (lib/rate-limit.ts) only sees part of the traffic. That is fine as a brake
 * on clicks, but not for the limits that protect something: alert sign-ups
 * (mail to strangers) and admin password guesses. Those count here, one row
 * per key, at the cost of one D1 write per counted request.
 */
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rowsChanged } from '@/lib/db/d1'
import { rateLimits } from '@/lib/db/schema'

/**
 * Count a hit against `key`, and say whether it is within `limit` per
 * `windowMs`. Hits past the limit still count, so a flood stays refused for
 * the rest of the window.
 */
export async function countHit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const expired = sql`${rateLimits.windowStart} <= ${now - windowMs}`
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: new Date(now), hits: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      // Both read the row as it was, so an expired window restarts at 1.
      set: {
        hits: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.hits} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN excluded.window_start ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ hits: rateLimits.hits })
  return (row?.hits ?? 1) <= limit
}

/** Whether `key` has used up `limit` in its current window, without counting. */
export async function isOverLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const [row] = await db
    .select({ hits: rateLimits.hits })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), gt(rateLimits.windowStart, new Date(now - windowMs))))
  return (row?.hits ?? 0) >= limit
}

/** Drop counters whose window ended long ago. Run by the daily refresh. */
export async function pruneRateLimits(olderThanMs = 2 * 86_400_000, now = Date.now()): Promise<number> {
  const result = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now - olderThanMs)))
    .run()
  return rowsChanged(result)
}
