/**
 * A small fixed-window rate limiter, kept in memory per Worker isolate.
 *
 * Enough to stop one client from flooding an endpoint (the clicks and
 * comparison counts behind the public proof figures). It sees only the
 * traffic one isolate handles and resets when the isolate does, so it is a
 * brake, not an accounting system. Limits that must hold everywhere (alert
 * sign-ups, admin password guesses) count in D1 instead: lib/limits.ts.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Drop expired buckets once the map grows, so it cannot grow without bound. */
function prune(now: number) {
  if (buckets.size < 10_000) return
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}

/**
 * Count one hit against `key` and say whether it is within `limit` per
 * `windowMs`. Hits past the limit are still counted, so a flood stays blocked
 * for the rest of the window.
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count++
  return bucket.count <= limit
}

/** Whether `key` is already over `limit`, without counting a hit. */
export function isLimited(key: string, limit: number): boolean {
  const bucket = buckets.get(key)
  return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= limit)
}

/**
 * The client's IP. Cloudflare sets CF-Connecting-IP and overwrites any value a
 * client sends; X-Forwarded-For covers local development.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** For tests only. */
export function __resetRateLimits(): void {
  buckets.clear()
}
