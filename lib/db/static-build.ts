/**
 * The database for `next build` and `next dev`: the local D1, through the
 * bridge that `npm run build` and `npm run dev` start (lib/db/d1-bridge.ts).
 *
 * Imported for its side effect by the site's root layout and by the routes
 * that render without it (sitemap, data files, share images). Next's
 * instrumentation hook would be the obvious place, but Next does not run it
 * during `next build`, which is exactly when the pages read the database.
 *
 * In the pipeline the local D1 holds a fresh export of the real database, so
 * the build makes no API calls and reads one consistent snapshot.
 */
import { d1Http } from './d1-http'
import { bindD1, isD1Bound } from './index'

const url = process.env.D1_BRIDGE_URL
const token = process.env.D1_BRIDGE_TOKEN

if (!isD1Bound()) {
  if (!url || !token) {
    throw new Error(
      'D1_BRIDGE_URL is not set: start Next with `npm run dev` or `npm run build`, which serve the local D1 to it',
    )
  }
  bindD1(d1Http({ accountId: 'local', databaseId: 'local', token, baseUrl: url, attempts: 2 }))
}
