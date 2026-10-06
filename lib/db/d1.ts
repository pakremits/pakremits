/**
 * The slice of Cloudflare's D1 binding API this codebase uses.
 *
 * Declared here rather than taken from @cloudflare/workers-types, whose
 * globals (Response, fetch, caches...) clash with the DOM types the Next.js
 * app compiles against. The Worker's real `env.DB`, the binding wrangler's
 * getPlatformProxy hands Node, and the REST client in ./d1-http all satisfy it.
 */

export interface D1Meta {
  changes?: number
  duration?: number
  last_row_id?: number
  rows_read?: number
  rows_written?: number
  [key: string]: unknown
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: D1Meta
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<{ count: number; duration: number }>
}

/** Rows a write statement changed, from a D1 run() result. */
export function rowsChanged(result: unknown): number {
  const changes = (result as { meta?: D1Meta } | null)?.meta?.changes
  return typeof changes === 'number' ? changes : 0
}
