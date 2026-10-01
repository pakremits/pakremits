import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAdminAuthorization } from '@/lib/admin/basic-auth'
import { allow, clientIp, isLimited } from '@/lib/rate-limit'

/**
 * HTTP Basic auth over /admin, checked against a single ADMIN_PASSWORD.
 *
 * Basic auth keeps this to one file with no session table, no login page, and
 * no cookie to leak. The username is ignored — only the password is checked.
 *
 * Note: this runs on the Edge runtime — Next 16's `proxy` convention, which
 * replaced `middleware` — so the check (lib/admin/basic-auth.ts) uses a
 * hand-rolled constant-time compare rather than node:crypto's timingSafeEqual.
 * Admin server actions repeat the same check (lib/admin/assert-admin.ts).
 */
export const config = { matcher: ['/admin/:path*'] }

function unauthorised() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="PakRemits admin", charset="UTF-8"' },
  })
}

/** Wrong passwords allowed per IP per window before every attempt is refused. */
const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 15 * 60 * 1000

export default function proxy(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    console.error('[admin] ADMIN_PASSWORD is not set — locking /admin')
    return unauthorised()
  }

  // A single shared password is the only factor, so guessing must be slow:
  // after MAX_FAILURES wrong answers from one IP, refuse until the window ends.
  const failureKey = `admin-fail:${clientIp(request)}`
  if (isLimited(failureKey, MAX_FAILURES)) {
    return new NextResponse('Too many attempts. Try again later.', {
      status: 429,
      headers: { 'Retry-After': String(FAILURE_WINDOW_MS / 1000) },
    })
  }

  if (!isAdminAuthorization(request.headers.get('authorization'))) {
    // The browser's first request carries no credentials at all; only count
    // real wrong answers.
    if (request.headers.get('authorization')) allow(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS)
    return unauthorised()
  }

  return NextResponse.next()
}
