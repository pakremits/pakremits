/**
 * The database every query in lib/ goes through: Cloudflare D1, via drizzle.
 *
 * Nothing here opens a connection. Whoever runs the code binds a D1 database
 * first, and the same queries then work in all three places:
 *
 *  - the Worker calls `bindD1(env.DB)` before handling a request. The binding is
 *    the same object for every request in an isolate, so concurrent requests
 *    agree on it;
 *  - Node scripts (seed, refresh) call `connectNodeD1()` from lib/db/node.ts,
 *    which binds the local D1 or, with D1_TARGET=remote, the real one over the
 *    D1 REST API;
 *  - the static build binds the local copy of the database the same way.
 */
import type { BatchItem } from 'drizzle-orm/batch'
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import { round } from '@/lib/ranking/compute'
import type { D1Database } from './d1'
import * as schema from './schema'

export type Db = DrizzleD1Database<typeof schema>

let bound: { binding: D1Database; db: Db } | undefined

/** Make `binding` the database for every query in this process or isolate. */
export function bindD1(binding: D1Database): Db {
  if (bound?.binding !== binding) {
    bound = { binding, db: drizzle(binding as never, { schema }) }
  }
  return bound.db
}

/** Forget the bound database. For tests, which bind a fresh one per file. */
export function unbindD1(): void {
  bound = undefined
}

export function getDb(): Db {
  if (!bound) {
    throw new Error(
      'No D1 database is bound: call bindD1(env.DB) in the Worker, or connectNodeD1() from lib/db/node.ts in Node',
    )
  }
  return bound.db
}

/**
 * The bound database, resolved on each use rather than at import, so modules
 * can import `db` before anything is bound.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop, real)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

export { schema }

/**
 * Run statements as D1 batches of up to `size`, in order.
 *
 * One batch is one round trip, which matters most over the REST API (1,200
 * requests per 5 minutes). A batch runs as a single transaction on a binding;
 * this does not make several batches atomic together. Returns each
 * statement's result, in order.
 */
export async function runBatch(items: BatchItem<'sqlite'>[], size = 50): Promise<unknown[]> {
  const results: unknown[] = []
  for (let start = 0; start < items.length; start += size) {
    const chunk = items.slice(start, start + size) as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]
    results.push(...(await getDb().batch(chunk)))
  }
  return results
}

/**
 * Parse a numeric column at the boundary.
 *
 * D1 returns REAL columns as numbers already; this still rejects NaN and
 * Infinity, and accepts the strings an aggregate over an empty set or a raw
 * query can produce, so a bad value fails loudly instead of rendering.
 */
export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(n)) throw new Error(`Expected a numeric value, got ${value}`)
  return n
}

/** An amount as stored: 2 decimals, as numeric(14,2) kept it in Postgres. */
export function toMoney(value: number): number {
  return round(value, 2)
}

/** A rate as stored: 6 decimals, as numeric(18,6) kept it in Postgres. */
export function toRate(value: number): number {
  return round(value, 6)
}
