/**
 * A D1 binding look-alike over the Cloudflare D1 REST API, for Node.
 *
 * The refresh runs on GitHub Actions, outside Cloudflare, so it has no Worker
 * binding. This implements the part of the binding API that drizzle's D1
 * driver calls (prepare, bind, all, raw, run, first, batch, exec) on top of
 * `POST /accounts/{account}/d1/database/{id}/query` and `/raw`, so the same
 * drizzle queries run unchanged in the Worker, in Node and in the build.
 *
 * Limits that shape it:
 *  - The Cloudflare API allows 1,200 requests per 5 minutes per user, and
 *    blocks a client that exceeds it for 5 minutes. Callers batch their
 *    writes; this retries a 429 after its Retry-After and counts requests so a
 *    run can report what it used.
 *  - D1 takes at most 100 bound parameters per statement.
 *  - A failed request is retried on 429, 5xx and network errors. A 5xx can
 *    arrive after the write happened, so a retried plain INSERT can repeat;
 *    the refresh only plain-inserts history rows, where a duplicate is harmless.
 */
import type { D1Database, D1Meta, D1PreparedStatement, D1Result } from './d1'

const API = 'https://api.cloudflare.com/client/v4'

export interface D1HttpOptions {
  accountId: string
  databaseId: string
  /** An API token with D1 edit permission. */
  token: string
  fetch?: typeof fetch
  /** Tries per request, including the first. */
  attempts?: number
  /** First retry delay, doubled for each later one. */
  backoffMs?: number
  /** Longest Retry-After honoured before giving up on the request. */
  maxRetryAfterMs?: number
}

export interface D1HttpDatabase extends D1Database {
  /** API requests made so far, retries included. */
  readonly requests: number
}

export class D1HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'D1HttpError'
  }
}

interface Envelope<T> {
  success?: boolean
  errors?: { code?: number; message?: string }[]
  result?: T[]
}

interface QueryResult {
  results?: Record<string, unknown>[]
  success?: boolean
  meta?: D1Meta
}

interface RawResult {
  results?: { columns?: string[]; rows?: unknown[][] }
  success?: boolean
  meta?: D1Meta
}

type Body = { sql: string; params?: unknown[] } | { batch: { sql: string; params: unknown[] }[] }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Values D1 can bind, converted as the Worker binding converts them. */
function toWire(value: unknown): unknown {
  if (value === null || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') {
    // JSON.stringify would silently turn these into null.
    if (!Number.isFinite(value)) throw new TypeError(`D1 cannot bind ${value}`)
    return value
  }
  throw new TypeError(`D1 cannot bind a ${value === undefined ? 'undefined' : typeof value} value`)
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

function toD1Result<T>(result: QueryResult | undefined): D1Result<T> {
  return {
    results: (result?.results ?? []) as T[],
    success: result?.success ?? true,
    meta: result?.meta ?? {},
  }
}

export function d1Http(options: D1HttpOptions): D1HttpDatabase {
  const doFetch = options.fetch ?? fetch
  const attempts = options.attempts ?? 5
  const backoffMs = options.backoffMs ?? 1000
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 5 * 60 * 1000
  const base = `${API}/accounts/${options.accountId}/d1/database/${options.databaseId}`
  let requests = 0

  async function call<T>(endpoint: 'query' | 'raw', body: Body): Promise<T[]> {
    let lastError: unknown
    let delay = 0
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (delay > 0) await sleep(delay)
      delay = backoffMs * 2 ** (attempt - 1)
      requests++

      let response: Response
      try {
        response = await doFetch(`${base}/${endpoint}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      } catch (error) {
        lastError = error
        continue
      }

      const text = await response.text()
      let envelope: Envelope<T> | null = null
      try {
        envelope = JSON.parse(text) as Envelope<T>
      } catch {
        // A proxy or edge error page; the status says what happened.
      }
      const detail =
        envelope?.errors
          ?.map((error) => [error.code, error.message].filter(Boolean).join(': '))
          .join('; ') || text.slice(0, 300)

      if (response.status === 429 || response.status >= 500) {
        lastError = new D1HttpError(`D1 API ${response.status}: ${detail}`, response.status)
        const wait = retryAfterMs(response)
        if (wait !== null) {
          if (wait > maxRetryAfterMs) break
          delay = wait
        }
        continue
      }

      if (!response.ok || !envelope?.success) {
        throw new D1HttpError(`D1 API ${response.status}: ${detail}`, response.status)
      }
      return envelope.result ?? []
    }
    throw lastError
  }

  class Statement implements D1PreparedStatement {
    constructor(
      readonly sql: string,
      readonly params: unknown[] = [],
    ) {}

    bind(...values: unknown[]): D1PreparedStatement {
      return new Statement(this.sql, values.map(toWire))
    }

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const [result] = await call<QueryResult>('query', { sql: this.sql, params: this.params })
      return toD1Result<T>(result)
    }

    run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      return this.all<T>()
    }

    async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
      const { results } = await this.all<Record<string, unknown>>()
      const row = results[0]
      if (!row) return null
      return (column === undefined ? row : (row[column] ?? null)) as T | null
    }

    async raw<T = unknown[]>(rawOptions?: { columnNames?: boolean }): Promise<T[]> {
      const [result] = await call<RawResult>('raw', { sql: this.sql, params: this.params })
      const rows = result?.results?.rows ?? []
      return (rawOptions?.columnNames ? [result?.results?.columns ?? [], ...rows] : rows) as T[]
    }
  }

  return {
    get requests() {
      return requests
    },

    prepare(query: string): D1PreparedStatement {
      return new Statement(query)
    },

    async batch<T = Record<string, unknown>>(
      statements: D1PreparedStatement[],
    ): Promise<D1Result<T>[]> {
      if (statements.length === 0) return []
      const batch = statements.map((statement) => {
        if (!(statement instanceof Statement)) {
          throw new TypeError('batch() takes statements prepared by this database')
        }
        return { sql: statement.sql, params: statement.params }
      })
      const results = await call<QueryResult>('query', { batch })
      if (results.length !== batch.length) {
        throw new D1HttpError(
          `D1 API returned ${results.length} results for a batch of ${batch.length}`,
          200,
        )
      }
      return results.map((result) => toD1Result<T>(result))
    },

    async exec(query: string) {
      const results = await call<QueryResult>('query', { sql: query })
      return {
        count: results.length,
        duration: results.reduce((total, result) => total + (result.meta?.duration ?? 0), 0),
      }
    },
  }
}
