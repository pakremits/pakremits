/**
 * Apply pending Drizzle migrations from ./drizzle.
 *
 * Fly runs this as the release command (fly.staging.toml) inside the new image,
 * before any Machine is replaced, and CI runs it against an empty database.
 * drizzle-kit and dotenv are dev dependencies, pruned from that image, so this
 * calls drizzle-orm's migrator directly. It is the same function
 * `drizzle-kit migrate` calls, with the same drizzle.__drizzle_migrations
 * bookkeeping, so `npm run db:migrate` and this script can be used against one
 * database interchangeably.
 *
 * All pending migrations run in one transaction: if any fails, none is applied,
 * and the non-zero exit stops the deploy.
 *
 * Locally: node --env-file=.env.local scripts/migrate.mjs
 */
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Same precedence as drizzle.config.ts.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DIRECT_URL or DATABASE_URL must be set')
  process.exit(1)
}

const sql = postgres(url, {
  max: 1,
  // Harmless in session mode; required if the pooler moves to transaction mode.
  prepare: false,
  // Silence the "already exists, skipping" notices from the bookkeeping setup.
  onnotice: () => {},
})

/** Rows in the bookkeeping table, or 0 when it does not exist yet. */
async function recorded() {
  try {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`
    return row.n
  } catch {
    return 0
  }
}

try {
  const before = await recorded()
  if (before === 0) {
    // Tables without bookkeeping mean the schema was created some other way
    // (drizzle-kit push, a restore). Replaying 0000 would fail on its first
    // CREATE TABLE anyway; this says why instead.
    const [{ present }] = await sql`select to_regclass('public.providers') is not null as present`
    if (present) {
      throw new Error(
        'tables exist but drizzle.__drizzle_migrations is empty: baseline it before migrating',
      )
    }
  }

  await migrate(drizzle(sql), {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })

  const after = await recorded()
  console.log(`[migrate] applied ${after - before} migration(s); ${after} recorded`)
} catch (error) {
  console.error('[migrate] failed:', error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
