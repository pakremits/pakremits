/**
 * A password on the whole site, for staging.
 *
 * A noindex alone still lets a search engine fetch staging and list its URLs;
 * behind HTTP Basic auth it sees only 401s. SITE_LOCKED=true (wrangler.jsonc
 * vars, staging only) turns the lock on, SITE_PASSWORD (a Worker secret) is
 * the password, and the username is ignored. With the lock on and no password
 * set, every request is refused: staging fails closed, never open.
 *
 * Every request has to reach the Worker for this, so staging routes all paths
 * through it (`run_worker_first: true`); production keeps its pages static.
 * /admin is left to its own password, and the admin password opens the rest
 * of the site too, since a browser may send it after visiting /admin.
 * Wrong passwords count towards the same kind of per-IP lockout as /admin.
 */
import { isAdminAuthorization } from '@/lib/admin/basic-auth'
import { countHit, isOverLimit } from '@/lib/limits'
import { clientIp } from '@/lib/rate-limit'

const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 15 * 60 * 1000

function locked(): Response {
  return new Response('This site is private.', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="PakRemits staging", charset="UTF-8"' },
  })
}

/** Null when the request may go through; otherwise the refusal. */
export async function siteLock(request: Request, url: URL): Promise<Response | null> {
  if (process.env.SITE_LOCKED !== 'true') return null
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return null

  const password = process.env.SITE_PASSWORD
  if (!password) {
    console.error('[site-lock] SITE_LOCKED is on but SITE_PASSWORD is not set: refusing every request')
    return new Response('This site is private.', { status: 503 })
  }

  const failureKey = `site-fail:${clientIp(request)}`
  if (await isOverLimit(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS)) {
    return new Response('Too many attempts. Try again later.', {
      status: 429,
      headers: { 'retry-after': String(FAILURE_WINDOW_MS / 1000) },
    })
  }

  const authorization = request.headers.get('authorization')
  if (isAdminAuthorization(authorization, password) || isAdminAuthorization(authorization)) return null

  // A first visit carries no credentials; only count wrong answers.
  if (authorization) await countHit(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS)
  return locked()
}
