/**
 * Affiliate redirect.
 *
 * Logs the click, then 302s to the provider. Two rules shape this:
 *
 *  - The click is logged *before* the redirect, but a logging failure must
 *    never cost the user their transfer. Everything is wrapped so the redirect
 *    happens regardless.
 *  - A provider with no approved affiliate programme still gets a working link
 *    to its homepage. A missing template is the normal pre-approval state, not
 *    an error, and must not produce a dead button.
 *  - The click and savings rows feed public figures, so a plain GET must not be
 *    able to inflate them: logging is rate-limited per IP (the redirect itself
 *    always happens), and the amount a savings row is worked out on is capped
 *    at the corridor's largest standard amount.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, toMoney } from '@/lib/db'
import {
  DELIVERY_METHODS,
  type SendCurrency,
  affiliateClicks,
  corridors,
  providers,
} from '@/lib/db/schema'
import { buildAffiliateUrl } from '@/lib/admin/affiliate'
import { recordSaving } from '@/lib/proof/ledger'
import { STANDARD_AMOUNTS } from '@/lib/corridors'
import { allow, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Clicks logged per IP per window. Generous for a person comparing; a brake on a script. */
const CLICKS_PER_WINDOW = 20
const CLICK_WINDOW_MS = 10 * 60 * 1000

const ParamsSchema = z.object({
  corridor: z.string().max(40).optional(),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  method: z.enum(DELIVERY_METHODS).optional(),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: slug } = await context.params
  const { searchParams } = new URL(request.url)
  const parsed = ParamsSchema.safeParse(Object.fromEntries(searchParams))
  const query = parsed.success ? parsed.data : {}

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1)

  if (!provider || !provider.active) {
    return NextResponse.redirect(new URL('/providers', request.url), 302)
  }

  // The benchmark row is not a real product and must never link out.
  if (provider.isBenchmark) {
    return NextResponse.redirect(new URL('/how-we-rank#bank-benchmark', request.url), 302)
  }

  const clickId = randomUUID()

  // Resolve the corridor for reporting. Best-effort — a bad slug in the query
  // string should not stop the redirect.
  let corridorId: number | null = null
  let corridorCurrency: SendCurrency | null = null
  if (query.corridor) {
    const [corridor] = await db
      .select({ id: corridors.id, currency: corridors.fromCurrency })
      .from(corridors)
      .where(eq(corridors.slug, query.corridor))
      .limit(1)
      .catch(() => [])
    corridorId = corridor?.id ?? null
    corridorCurrency = corridor?.currency ?? null
  }

  const logClick = allow(`go:${clientIp(request)}`, CLICKS_PER_WINDOW, CLICK_WINDOW_MS)

  // A savings row worked out on £1,000,000 would move the headline figure on
  // its own; the largest amount we quote at is as far as a click can count.
  const grid = corridorCurrency ? STANDARD_AMOUNTS[corridorCurrency] : undefined
  const ledgerAmount =
    query.amount && grid?.length ? Math.min(query.amount, Math.max(...grid)) : (query.amount ?? null)

  if (logClick) {
    try {
      const [inserted] = await db.insert(affiliateClicks).values({
        providerId: provider.id,
        corridorId,
        amountSent: query.amount ? toMoney(query.amount) : null,
        deliveryMethod: query.method ?? null,
        clickId,
        referrer: request.headers.get('referer'),
        // Preserve campaign attribution without storing anything identifying.
        utm: [...searchParams.entries()]
          .filter(([key]) => key.startsWith('utm_'))
          .map(([key, value]) => `${key}=${value}`)
          .join('&') || null,
      }).returning({ id: affiliateClicks.id })

      // The savings ledger hangs off the click, so it can only be written once
      // the click has an id. Awaited rather than fired and forgotten: a
      // serverless function can be frozen the moment the response is returned,
      // and a dropped ledger row would understate the site's own headline number.
      if (inserted) {
        await recordSaving({
          affiliateClickId: inserted.id,
          providerId: provider.id,
          corridorId,
          currency: corridorCurrency,
          amount: ledgerAmount,
          method: query.method ?? null,
        })
      }
    } catch (error) {
      // Losing a click row is bad for reporting and irrelevant to the user.
      console.error('[go] click logging failed:', error)
    }
  }

  const destination = buildAffiliateUrl({
    template: provider.affiliateUrlTemplate,
    homepageUrl: provider.homepageUrl,
    clickId,
  })

  if (!destination) {
    return NextResponse.redirect(new URL('/providers', request.url), 302)
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      // Never cache a redirect that mints a per-click tracking id.
      'cache-control': 'no-store, max-age=0',
      // Do not leak the amount someone is sending to the provider's analytics.
      'referrer-policy': 'origin',
    },
  })
}
