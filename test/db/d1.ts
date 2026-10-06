/**
 * A real D1 for tests: wrangler's local runtime, in memory, with every
 * migration in migrations/ applied, bound as the database lib/ queries use.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { bindD1, db, unbindD1 } from '@/lib/db'
import type { D1Database } from '@/lib/db/d1'
import { type SendCurrency, corridors, providers } from '@/lib/db/schema'

const MIGRATIONS = join(__dirname, '../../migrations')

/** Children before parents, so deleting in this order never trips a foreign key. */
const TABLES = [
  'savings_ledger',
  'affiliate_clicks',
  'comparison_events',
  'corridor_leaders',
  'bank_benchmarks',
  'latest_quotes',
  'rate_quotes',
  'rate_alerts',
  'mid_market_rates',
  'site_stats_daily',
  'cron_runs',
  'providers',
  'corridors',
]

export interface TestD1 {
  binding: D1Database
  /** Empty every table, for a clean slate between tests. */
  reset(): Promise<void>
  dispose(): Promise<void>
}

export async function startD1(): Promise<TestD1> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    persist: false,
    remoteBindings: false,
    envFiles: [],
  })
  const binding = proxy.env.DB

  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    const statements = readFileSync(join(MIGRATIONS, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)
    await binding.batch(statements.map((statement) => binding.prepare(statement)))
  }

  bindD1(binding)

  return {
    binding,
    reset: async () => {
      await binding.batch(TABLES.map((table) => binding.prepare(`DELETE FROM ${table}`)))
    },
    dispose: async () => {
      unbindD1()
      await proxy.dispose()
    },
  }
}

/** Insert a provider with sensible defaults; returns its id. */
export async function addProvider(
  slug: string,
  overrides: Partial<typeof providers.$inferInsert> = {},
): Promise<number> {
  const [row] = await db
    .insert(providers)
    .values({
      slug,
      name: slug,
      homepageUrl: `https://${slug}.example`,
      supportsBank: true,
      ...overrides,
    })
    .returning({ id: providers.id })
  return row.id
}

/** Insert a corridor; returns its id. */
export async function addCorridor(
  slug = 'uk',
  fromCurrency: SendCurrency = 'GBP',
  fromCountry = 'GB',
): Promise<number> {
  const [row] = await db
    .insert(corridors)
    .values({
      slug,
      fromCurrency,
      fromCountry,
      fromCountryName: slug.toUpperCase(),
      currencySymbol: '£',
    })
    .returning({ id: corridors.id })
  return row.id
}

/** The time `hours` hours before `from`. */
export function hoursAgo(hours: number, from = Date.now()): Date {
  return new Date(from - hours * 3_600_000)
}
