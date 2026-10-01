/**
 * Quotes endpoint for the interactive comparison panel.
 *
 * The home page renders a full table server-side; this route only serves the
 * updates when the user changes country, method, or amount. Everything it
 * returns is already computed — the client does no ranking or arithmetic, so
 * there is exactly one implementation of the ranking rules.
 */
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DELIVERY_METHODS } from '@/lib/db/schema'
import { CORRIDORS } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'
import { SESSION_COOKIE, recordComparisonRun } from '@/lib/proof/events'
import { allow, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const QuerySchema = z.object({
  corridor: z.enum(CORRIDORS.map((c) => c.slug) as [string, ...string[]]),
  method: z.enum(DELIVERY_METHODS).default('bank'),
  // Capped well above any realistic remittance: past this the standard-amount
  // grid stops being a reasonable approximation.
  amount: z.coerce.number().positive().max(1_000_000).default(500),
  sort: z.enum(['received', 'fastest', 'lowest-fee']).default('received'),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 },
    )
  }

  const { corridor, method, amount, sort } = parsed.data

  try {
    const comparison = await getComparison({
      corridorSlug: corridor,
      method,
      amount,
      sortBy: sort,
    })

    if (!comparison) {
      return NextResponse.json({ error: 'Unknown corridor' }, { status: 404 })
    }

    // Count the comparison. Deduplicated to one per session per minute inside
    // recordComparisonRun, so dragging the amount field is one event, not forty.
    //
    // Only for a session we issued earlier: a request without the cookie gets
    // one now and is not counted, so a client that drops cookies (a script
    // looping on this URL) never adds to the public "comparisons this month"
    // figure. A per-IP brake covers a script that keeps the cookie.
    const jar = await cookies()
    const storedSessionId = jar.get(SESSION_COOKIE)?.value
    const hasValidSession = Boolean(storedSessionId && UUID_PATTERN.test(storedSessionId))
    const sessionId = hasValidSession ? storedSessionId! : randomUUID()

    if (hasValidSession && allow(`quotes:${clientIp(request)}`, 30, 60 * 60 * 1000)) {
      await recordComparisonRun(sessionId, comparison.corridorId ?? null)
    }

    const response = NextResponse.json(comparison, {
      headers: {
        // Per-session counting makes this response session-specific, so it can
        // no longer sit in a shared CDN cache. `private` keeps the browser
        // cache — which still absorbs a dragged slider — without one visitor's
        // response being served to another.
        'cache-control': 'private, max-age=60',
      },
    })

    if (!hasValidSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // Long enough to deduplicate a visit, short enough not to be a
        // durable identifier. Nothing personal is stored against it.
        maxAge: 60 * 60 * 24,
      })
    }

    return response
  } catch (error) {
    console.error('[api/quotes] failed:', error)
    return NextResponse.json({ error: 'Could not load quotes' }, { status: 500 })
  }
}
