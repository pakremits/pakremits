import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit only generates migrations here (`npm run db:generate`). Wrangler
 * applies them: `npm run db:migrate:local`, or `db:migrate:remote` for the
 * real database. Migrations only ever add (expand/contract), because a Worker
 * rollback does not roll the database back.
 */
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
})
