/**
 * The local D1, served over HTTP to `next build` and `next dev`.
 *
 * Next renders pages in several worker processes, and the local D1 (a SQLite
 * file owned by workerd) cannot be opened by more than one process at a time:
 * the second fails with SQLITE_BUSY. So one parent process opens it, through
 * wrangler's getPlatformProxy, and answers the D1 REST API's own requests
 * (`POST /query` and `/raw`, single or batched) on a loopback port. The Next
 * processes reach it with the same client the refresh uses for the real API
 * (./d1-http), so every query runs exactly as it would anywhere else.
 *
 * Node only, and local only: it listens on 127.0.0.1 and requires a random
 * per-run token.
 */
import { randomBytes } from 'node:crypto'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import type { D1Database, D1PreparedStatement } from './d1'
import { openLocalD1 } from './node'

interface Statement {
  sql: string
  params?: unknown[]
}

export interface D1Bridge {
  url: string
  token: string
  close(): Promise<void>
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function prepare(db: D1Database, statement: Statement): D1PreparedStatement {
  return db.prepare(statement.sql).bind(...(statement.params ?? []))
}

async function answer(db: D1Database, endpoint: string, body: unknown): Promise<unknown[]> {
  const request = body as Statement | { batch: Statement[] }
  if ('batch' in request) {
    return db.batch(request.batch.map((statement) => prepare(db, statement)))
  }
  if (endpoint === '/raw') {
    const [columns = [], ...rows] = await prepare(db, request).raw<unknown[]>({ columnNames: true })
    return [{ results: { columns, rows }, success: true, meta: {} }]
  }
  return [await prepare(db, request).all()]
}

/** Open the local D1 and serve it on a free loopback port until closed. */
export async function startD1Bridge(): Promise<D1Bridge> {
  const proxy = await openLocalD1()
  const db = proxy.env.DB
  const token = randomBytes(24).toString('hex')

  const server = createServer((request, response) => {
    const endpoint = request.url ?? ''
    if (request.method !== 'POST' || (endpoint !== '/query' && endpoint !== '/raw')) {
      return reply(response, 404, { success: false, errors: [{ message: 'Not found' }] })
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      return reply(response, 403, { success: false, errors: [{ message: 'Forbidden' }] })
    }
    readJson(request)
      .then((body) => answer(db, endpoint, body))
      .then((result) => reply(response, 200, { success: true, errors: [], result }))
      .catch((error: unknown) =>
        // A 400, which the client does not retry: an SQL error is not transient.
        reply(response, 400, {
          success: false,
          errors: [{ message: error instanceof Error ? error.message : String(error) }],
        }),
      )
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('The D1 bridge has no port')

  return {
    url: `http://127.0.0.1:${address.port}`,
    token,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await proxy.dispose()
    },
  }
}
