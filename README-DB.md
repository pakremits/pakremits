# PakRemits — the database

The database is Cloudflare D1, which is SQLite. Drizzle describes the schema and
writes the migrations; wrangler applies them. This repository contains no
production data or credentials.

## Files

- `lib/db/schema.ts` — the Drizzle schema and source of truth
- `migrations/` — SQL migrations generated from it, applied in order by wrangler
- `drizzle.config.ts` — Drizzle Kit configuration
- `lib/db/index.ts` — the shared `db` for whichever D1 is bound (`bindD1`), and
  the number helpers `toNum`, `toMoney` and `toRate`
- `lib/db/d1-http.ts` — a D1 binding over the REST API, for code that runs
  outside Cloudflare: the refresh and the scripts
- `lib/db/node.ts` — picks the local database or the real one (`D1_TARGET`)
- `lib/db/d1-bridge.ts` and `scripts/with-local-d1.ts` — serve the local
  database to `next build` and `next dev`, whose workers cannot all open the
  local files at once
- `lib/quotes-write.ts` — writes the quote history and the latest quotes together
- `scripts/seed.ts` and `scripts/seed-proof-demo.ts` — starter data
- `scripts/refresh-local.ts` — the refresh entry point
- `scripts/db-check.ts` — runs each kind of query once and prints a summary
- `scripts/d1-contract.ts` — checks that the REST API still binds values,
  batches and returns rows the way `d1-http.ts` relies on; every publish runs
  it before a refresh

## Three ways in

| Who | How |
| --- | --- |
| The Worker | The `DB` binding in `wrangler.jsonc`, bound for each request |
| The refresh and scripts | `D1_TARGET=local` (the default): the local files, through wrangler. `D1_TARGET=remote`: the REST API, with `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID` and `CLOUDFLARE_D1_TOKEN` from `.env.local` |
| `next build` | A local copy. Before each build, `publish.yml` exports the real database into it, so the build makes no API calls and every page reads the same snapshot |

## Set up a database

Locally:

```bash
npm run db:migrate:local
npm run seed
npm run refresh
```

The real database is created once (see *One-time setup* in
[README.md](./README.md#one-time-setup)). After that, every publish applies
pending migrations before it deploys. To run a script against it from your own
machine, set `D1_TARGET=remote` and the three values above, for example
`D1_TARGET=remote npm run db:check`.

## Schema notes

- SQLite has no decimal type. Money is stored as `real` and rounded to 2 decimal
  places on the way in (`toMoney`), rates to 6 (`toRate`).
- Timestamps are integer milliseconds and flags are 0 or 1; Drizzle converts
  both to `Date` and `boolean`.
- `latest_quotes` holds the newest quote for each corridor, method, amount and
  provider, and is what every price on the site reads. `rate_quotes` keeps 45
  days of history for the admin. `lib/quotes-write.ts` writes both in one
  batch, so they never disagree.
- D1 limits to know when writing queries: at most 100 bound parameters per
  statement (insert in chunks), no interactive transactions (use `db.batch`,
  which is atomic), and a large `UNION ALL` fails with "too many terms in
  compound SELECT".
- Migrations are expand-then-contract: they run before the new code deploys,
  and a rollback does not undo them.
- `rate_alerts` holds subscribers' contact details in production. The seed
  scripts contain no live subscriber data.

## Backups

- **D1 Time Travel** restores to any point in the last 7 days on the free plan:
  `npx wrangler d1 time-travel restore pakremits-staging --timestamp <time>`.
- **A daily export** goes to the private R2 bucket named in `BACKUP_BUCKET`,
  as `<environment>/<date>/schema.sql` and `data.sql`. To restore one, apply
  `schema.sql` to an empty database, then `data.sql`.

Never upload an export as an Actions artifact: the repository is public.
