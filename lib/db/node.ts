/**
 * D1 from Node: the seed, the refresh and the other scripts.
 *
 *   D1_TARGET=local (the default) opens the local database wrangler keeps in
 *     .wrangler/state: the one `npm run db:migrate:local` migrates and
 *     `wrangler dev` serves. It goes through wrangler's getPlatformProxy, so it
 *     runs on the same SQLite engine as production D1.
 *   D1_TARGET=remote talks to the real database over the D1 REST API
 *     (./d1-http), with CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID and
 *     CLOUDFLARE_D1_TOKEN from the environment.
 *
 * Node only: it loads wrangler, so the Worker must never import it.
 */
import type { D1Database } from './d1'
import { d1Http } from './d1-http'
import { type Db, bindD1, unbindD1 } from './index'

export type D1Target = 'local' | 'remote'

export interface NodeD1 {
  db: Db
  target: D1Target
  /** REST API requests made so far; always 0 locally. */
  requests(): number
  close(): Promise<void>
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set (needed for D1_TARGET=remote)`)
  return value
}

/** The local D1 through wrangler, in this process. Dispose of it when done. */
export async function openLocalD1() {
  const { getPlatformProxy } = await import('wrangler')
  return getPlatformProxy<{ DB: D1Database }>({
    // The local database only, even if the config ever marks it remote.
    remoteBindings: false,
    // Only the D1 binding is used; keep .env secrets out of the local runtime.
    envFiles: [],
  })
}

/** Bind the database named by D1_TARGET for every query in this process. */
export async function connectNodeD1(
  target: string = process.env.D1_TARGET || 'local',
): Promise<NodeD1> {
  if (target === 'remote') {
    const client = d1Http({
      accountId: required('CLOUDFLARE_ACCOUNT_ID'),
      databaseId: required('D1_DATABASE_ID'),
      token: required('CLOUDFLARE_D1_TOKEN'),
    })
    return {
      db: bindD1(client),
      target,
      requests: () => client.requests,
      close: async () => unbindD1(),
    }
  }

  if (target !== 'local') {
    throw new Error(`D1_TARGET must be "local" or "remote", got "${target}"`)
  }

  const proxy = await openLocalD1()
  return {
    db: bindD1(proxy.env.DB),
    target,
    requests: () => 0,
    close: async () => {
      unbindD1()
      await proxy.dispose()
    },
  }
}
