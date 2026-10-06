import { describe, expect, it, vi } from 'vitest'
import { D1HttpError, d1Http } from '@/lib/db/d1-http'

const BASE = 'https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db1'

type Call = { url: string; body: unknown; headers: Record<string, string> }

/** A fetch that answers from a queue of responses and records each request. */
function fakeFetch(...responses: (Response | Error)[]) {
  const calls: Call[] = []
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    })
    const next = responses.shift()
    if (!next) throw new Error('no response queued')
    if (next instanceof Error) throw next
    return next
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const ok = (result: unknown[]) =>
  new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), { status: 200 })

const client = (fetch: typeof globalThis.fetch) =>
  d1Http({ accountId: 'acc', databaseId: 'db1', token: 'test-token', fetch, backoffMs: 0 })

describe('d1Http', () => {
  it('sends a statement with its parameters to /query and returns the rows', async () => {
    const { fetch, calls } = fakeFetch(
      ok([{ results: [{ id: 1, name: 'Wise' }], success: true, meta: { changes: 0, rows_read: 1 } }]),
    )

    const result = await client(fetch)
      .prepare('SELECT id, name FROM providers WHERE slug = ? AND active = ?')
      .bind('wise', true)
      .all()

    expect(calls[0].url).toBe(`${BASE}/query`)
    expect(calls[0].headers.authorization).toBe('Bearer test-token')
    // Booleans bind as 0/1, as the Worker binding binds them.
    expect(calls[0].body).toEqual({
      sql: 'SELECT id, name FROM providers WHERE slug = ? AND active = ?',
      params: ['wise', 1],
    })
    expect(result.results).toEqual([{ id: 1, name: 'Wise' }])
    expect(result.meta.rows_read).toBe(1)
  })

  it('reads raw rows from /raw, with column names on request', async () => {
    const rawResult = { results: { columns: ['id', 'rate'], rows: [[1, 370.5]] }, success: true, meta: {} }
    const { fetch, calls } = fakeFetch(ok([rawResult]), ok([rawResult]))
    const db = client(fetch)

    expect(await db.prepare('SELECT id, rate FROM q').raw()).toEqual([[1, 370.5]])
    expect(await db.prepare('SELECT id, rate FROM q').raw({ columnNames: true })).toEqual([
      ['id', 'rate'],
      [1, 370.5],
    ])
    expect(calls[0].url).toBe(`${BASE}/raw`)
  })

  it('binds numbers and null as JSON and refuses values D1 cannot store', async () => {
    const { fetch, calls } = fakeFetch(ok([{ results: [], success: true, meta: {} }]))
    const db = client(fetch)

    await db.prepare('INSERT INTO t VALUES (?, ?, ?)').bind(1728200000123, 370.123456, null).run()
    expect((calls[0].body as { params: unknown[] }).params).toEqual([1728200000123, 370.123456, null])

    expect(() => db.prepare('?').bind(Number.NaN)).toThrow(TypeError)
    expect(() => db.prepare('?').bind(undefined)).toThrow(TypeError)
  })

  it('sends a batch as one request and returns one result per statement', async () => {
    const { fetch, calls } = fakeFetch(
      ok([
        { results: [], success: true, meta: { changes: 1 } },
        { results: [{ id: 7 }], success: true, meta: { changes: 1 } },
      ]),
    )
    const db = client(fetch)

    const results = await db.batch([
      db.prepare('INSERT INTO a (x) VALUES (?)').bind(1),
      db.prepare('INSERT INTO b (y) VALUES (?) RETURNING id').bind('two'),
    ])

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(calls[0].body).toEqual({
      batch: [
        { sql: 'INSERT INTO a (x) VALUES (?)', params: [1] },
        { sql: 'INSERT INTO b (y) VALUES (?) RETURNING id', params: ['two'] },
      ],
    })
    expect(results.map((result) => result.results)).toEqual([[], [{ id: 7 }]])
    expect(results[0].meta.changes).toBe(1)
  })

  it('retries a 429 after its Retry-After, then a 5xx and a network error', async () => {
    const { fetch } = fakeFetch(
      new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }),
      new Response('bad gateway', { status: 502 }),
      new TypeError('fetch failed'),
      ok([{ results: [{ n: 1 }], success: true, meta: {} }]),
    )
    const db = client(fetch)

    const row = await db.prepare('SELECT 1 AS n').first<{ n: number }>()
    expect(row).toEqual({ n: 1 })
    expect(db.requests).toBe(4)
  })

  it('gives up after its attempts and reports the last error', async () => {
    const { fetch } = fakeFetch(
      ...Array.from({ length: 5 }, () => new Response('down', { status: 503 })),
    )
    await expect(client(fetch).prepare('SELECT 1').all()).rejects.toThrow('D1 API 503')
  })

  it('does not retry an SQL error, and surfaces D1’s message', async () => {
    const { fetch } = fakeFetch(
      new Response(
        JSON.stringify({ success: false, errors: [{ code: 7500, message: 'no such table: nope' }], result: [] }),
        { status: 400 },
      ),
    )
    const db = client(fetch)

    const error = await db.prepare('SELECT * FROM nope').all().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(D1HttpError)
    expect((error as D1HttpError).message).toContain('no such table: nope')
    expect(db.requests).toBe(1)
  })

  it('stops waiting when Retry-After is longer than it is willing to wait', async () => {
    const { fetch } = fakeFetch(
      new Response('blocked', { status: 429, headers: { 'retry-after': '600' } }),
    )
    const db = d1Http({ accountId: 'acc', databaseId: 'db1', token: 't', fetch, maxRetryAfterMs: 1000 })

    await expect(db.prepare('SELECT 1').all()).rejects.toThrow('D1 API 429')
    expect(db.requests).toBe(1)
  })

  it('rejects a batch result that does not match the statements sent', async () => {
    const { fetch } = fakeFetch(ok([{ results: [], success: true, meta: {} }]))
    const db = client(fetch)

    await expect(
      db.batch([db.prepare('SELECT 1'), db.prepare('SELECT 2')]),
    ).rejects.toThrow('returned 1 results for a batch of 2')
  })
})
