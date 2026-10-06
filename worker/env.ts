/**
 * What the Worker is given: the bindings in wrangler.jsonc, plus its vars and
 * secrets.
 *
 * The shared code in lib/ reads vars and secrets through process.env, which
 * the runtime fills from these (nodejs_compat), so it runs here unchanged.
 * The types are declared here rather than taken from
 * @cloudflare/workers-types, whose globals clash with the DOM types the rest
 * of the project compiles against.
 */
import type { D1Database } from '@/lib/db/d1'

/** The static site in out/, served by the assets binding. */
export interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

export interface Env {
  DB: D1Database
  ASSETS: AssetsBinding
}

export interface WorkerContext {
  /** Keeps the Worker alive for work that finishes after the response. */
  waitUntil(promise: Promise<unknown>): void
}
