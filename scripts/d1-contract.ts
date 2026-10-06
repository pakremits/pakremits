/**
 * Check that the D1 REST API still behaves the way lib/db/d1-http.ts relies
 * on, before a refresh writes through it.
 *
 * The API's documented contract is looser than what the refresh depends on:
 * its schema lists every parameter as a string, but SQL comparisons and
 * arithmetic only behave as they do in the Worker if numbers bind as numbers.
 * Drizzle reads selects through /raw as columns and rows. And a quote's
 * history row and latest row are written in one batch, which must be one
 * transaction. A change in any of these would corrupt data quietly, so
 * publish.yml runs this first and stops the refresh if anything differs.
 *
 * It leaves nothing behind: its probe rows are rolled back or deleted.
 *
 *   D1_TARGET=remote npm run db:contract
 */
import '../lib/load-env'
import { d1Http } from '../lib/db/d1-http'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function connect() {
  // Under scripts/with-local-d1.ts, the local bridge: a way to test this script.
  const bridge = process.env.D1_BRIDGE_URL
  if (bridge) {
    return d1Http({ accountId: 'local', databaseId: 'local', token: required('D1_BRIDGE_TOKEN'), baseUrl: bridge })
  }
  if (process.env.D1_TARGET !== 'remote') throw new Error('Set D1_TARGET=remote: this checks the real D1 API')
  return d1Http({
    accountId: required('CLOUDFLARE_ACCOUNT_ID'),
    databaseId: required('D1_DATABASE_ID'),
    token: required('CLOUDFLARE_D1_TOKEN'),
  })
}

const failures: string[] = []

function expect(what: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(ok ? `ok    ${what}` : `FAIL  ${what}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  if (!ok) failures.push(what)
}

async function main() {
  const db = connect()

  // Numbers bind as numbers, not text: an integer, a fraction and a
  // millisecond timestamp (past 32 bits). The Worker binding passes every
  // number as REAL and column affinity stores whole ones as INTEGER, so
  // either numeric type will do; TEXT would not.
  const stamp = 1767225600000
  const types = await db
    .prepare('SELECT typeof(?) AS a, typeof(?) AS b, typeof(?) AS c, typeof(?) AS d, typeof(?) AS e, ? + 1 AS next')
    .bind(42, 1.5, stamp, 'PKR', null, stamp)
    .first<Record<string, unknown>>()
  const numeric = (type: unknown) => (type === 'integer' || type === 'real' ? 'number' : type)
  expect('parameter types', types && [types.a, types.b, types.c, types.d, types.e].map(numeric), [
    'number',
    'number',
    'number',
    'text',
    'null',
  ])
  expect('arithmetic on a timestamp', types?.next, stamp + 1)

  const raw = await db.prepare('SELECT ? AS amount, ? AS currency').bind(500, 'GBP').raw({ columnNames: true })
  expect('/raw columns and rows', raw, [
    ['amount', 'currency'],
    [500, 'GBP'],
  ])

  // A batch is one transaction: when a statement fails, the ones before it
  // are undone. The probe is a rate_limits row under a key nothing else uses;
  // inserting it twice breaks the primary key on the second statement.
  const key = `contract-check:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
  const insert = () =>
    db.prepare('INSERT INTO rate_limits (key, window_start, hits) VALUES (?, ?, 1) RETURNING key').bind(key, Date.now())
  let threw = false
  try {
    await db.batch([insert(), insert()])
  } catch {
    threw = true
  }
  expect('a failing batch throws', threw, true)
  const left = await db.prepare('SELECT count(*) AS n FROM rate_limits WHERE key = ?').bind(key).first<{ n: number }>()
  expect('a failing batch rolls back', left?.n, 0)
  if (left?.n) await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run()

  // RETURNING and change counts, in a batch that removes its own row.
  const [inserted, deleted] = await db.batch<{ key: string }>([
    insert(),
    db.prepare('DELETE FROM rate_limits WHERE key = ? RETURNING key').bind(key),
  ])
  expect('RETURNING from an insert', inserted?.results.map((row) => row.key), [key])
  expect('RETURNING from a delete', deleted?.results.map((row) => row.key), [key])
  expect('rows changed', deleted?.meta.changes, 1)

  console.log(`\n${db.requests} API requests`)
  if (failures.length > 0) {
    throw new Error(`The D1 API no longer behaves as lib/db/d1-http.ts expects: ${failures.join('; ')}`)
  }
  console.log('The D1 API behaves as expected.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
