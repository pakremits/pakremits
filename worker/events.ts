/**
 * POST /api/events: the browser's "a comparison was run" beacon, which feeds
 * the public "comparisons this month" figure (lib/proof/events.ts).
 *
 * Counted only for a session we issued earlier: a request without the cookie
 * gets one now and is not counted, so a client that drops cookies (a script
 * looping on this URL) never adds to the figure. A per-IP brake covers a
 * script that keeps the cookie, and the database keeps one event per session
 * per minute.
 */
import { eq } from 'drizzle-orm'
import { CORRIDORS } from '@/lib/corridors'
import { db } from '@/lib/db'
import { corridors } from '@/lib/db/schema'
import { SESSION_COOKIE, recordComparisonRun } from '@/lib/proof/events'
import { allow, clientIp } from '@/lib/rate-limit'
import type { WorkerContext } from './env'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Counted comparisons per IP per hour. */
const EVENTS_PER_HOUR = 30

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

async function count(sessionId: string, corridorSlug: string) {
  const [corridor] = await db
    .select({ id: corridors.id })
    .from(corridors)
    .where(eq(corridors.slug, corridorSlug))
    .limit(1)
  await recordComparisonRun(sessionId, corridor?.id ?? null)
}

export async function handleEvent(request: Request, url: URL, ctx: WorkerContext): Promise<Response> {
  let corridorSlug: unknown
  try {
    corridorSlug = ((await request.json()) as { corridor?: unknown }).corridor
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!CORRIDORS.some((corridor) => corridor.slug === corridorSlug)) {
    return new Response(null, { status: 400 })
  }

  const stored = readCookie(request, SESSION_COOKIE)
  const hasSession = Boolean(stored && UUID_PATTERN.test(stored))

  if (hasSession && allow(`events:${clientIp(request)}`, EVENTS_PER_HOUR, 60 * 60 * 1000)) {
    // The answer does not depend on it, so the write happens after the response.
    ctx.waitUntil(count(stored!, corridorSlug as string))
  }

  const headers = new Headers({ 'cache-control': 'no-store' })
  if (!hasSession) {
    // Long enough to deduplicate a visit, short enough not to be a durable
    // identifier. Nothing personal is stored against it.
    headers.append(
      'set-cookie',
      `${SESSION_COOKIE}=${crypto.randomUUID()}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax` +
        (url.protocol === 'https:' ? '; Secure' : ''),
    )
  }
  return new Response(null, { status: 204, headers })
}
