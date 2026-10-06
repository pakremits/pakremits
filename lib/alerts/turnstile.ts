/**
 * Turnstile tokens are short-lived and single-use. Always verify at sign-up.
 *
 * Outside production the secret falls back to Cloudflare's always-pass test
 * key, which answers for the hostname example.com. Only there, and only for
 * an answer marked as coming from a testing key, is the hostname not checked,
 * so the sign-up flow can be exercised on a local or preview host.
 */
export async function verifyTurnstile(token: string, hostname: string): Promise<boolean> {
  const production = process.env.NODE_ENV === 'production'
  const secret = process.env.TURNSTILE_SECRET_KEY || (production ? undefined : '1x0000000000000000000000000000000AA')
  if (!secret || !token) return false

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (!response.ok) return false
    const result = (await response.json()) as {
      success?: boolean
      hostname?: string
      metadata?: { result_with_testing_key?: boolean }
    }
    if (result.success !== true) return false
    if (!production && result.metadata?.result_with_testing_key === true) return true
    return result.hostname === hostname
  } catch {
    return false
  }
}
