/**
 * The admin password check, shared by proxy.ts (every /admin request) and the
 * admin server actions (a second check inside each action).
 *
 * HTTP Basic auth against a single ADMIN_PASSWORD; the username is ignored.
 * Fails closed when ADMIN_PASSWORD is unset. Uses only Web APIs (atob,
 * TextEncoder), so it runs in the Edge-runtime proxy as well as in Node.
 */

/** Constant-time string compare that does not leak length via early exit. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  if (ab.length !== bb.length) return false

  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

/** Whether an Authorization header carries the admin password. */
export function isAdminAuthorization(header: string | null, expected = process.env.ADMIN_PASSWORD): boolean {
  if (!expected || !header?.startsWith('Basic ')) return false

  let decoded: string
  try {
    decoded = atob(header.slice('Basic '.length))
  } catch {
    return false
  }

  // "user:password" — everything after the first colon is the password.
  const password = decoded.slice(decoded.indexOf(':') + 1)
  return safeEqual(password, expected)
}
