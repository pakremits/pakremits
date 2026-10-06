/**
 * GET /go/{provider}: the affiliate redirect.
 *
 * Logs the click, then 302s to the provider. The rules that shape it:
 *
 *  - A logging failure must never cost the user their transfer: the redirect
 *    goes out at once, and the click and savings rows are written after it
 *    (waitUntil keeps the Worker alive until they are).
 *  - A provider with no approved affiliate programme still gets a working link
 *    to its homepage. A missing template is the normal pre-approval state, not
 *    an error, and must not produce a dead button.
 *  - The click and savings rows feed public figures, so a plain GET must not be
 *    able to inflate them: logging is rate-limited per IP (the redirect itself
 *    always happens), and the amount a savings row is worked out on is capped
 *    at the corridor's largest standard amount.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { buildAffiliateUrl } from '@/lib/admin/affiliate'
import { STANDARD_AMOUNTS } from '@/lib/corridors'
import { db, toMoney } from '@/lib/db'
import { DELIVERY_METHODS, type Provider, affiliateClicks, corridors, providers } from '@/lib/db/schema'
import { recordSaving } from '@/lib/proof/ledger'
import { allow, clientIp } from '@/lib/rate-limit'
import type { WorkerContext } from './env'
import { redirect } from './http'

/** Clicks logged per IP per window. Generous for a person comparing; a brake on a script. */
const CLICKS_PER_WINDOW = 20
const CLICK_WINDOW_MS = 10 * 60 * 1000

const ParamsSchema = z.object({
  corridor: z.string().max(40).optional(),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  method: z.enum(DELIVERY_METHODS).optional(),
})

type Query = z.infer<typeof ParamsSchema>

async function logClick(request: Request, url: URL, provider: Provider, clickId: string, query: Query) {
  try {
    // Resolve the corridor for reporting. Best-effort: a bad slug in the query
    // string records the click without one.
    const [corridor] = query.corridor
      ? await db
          .select({ id: corridors.id, currency: corridors.fromCurrency })
          .from(corridors)
          .where(eq(corridors.slug, query.corridor))
          .limit(1)
      : []

    // A savings row worked out on £1,000,000 would move the headline figure on
    // its own; the largest amount we quote at is as far as a click can count.
    const grid = corridor ? STANDARD_AMOUNTS[corridor.currency] : undefined
    const ledgerAmount =
      query.amount && grid?.length ? Math.min(query.amount, Math.max(...grid)) : (query.amount ?? null)

    const [inserted] = await db
      .insert(affiliateClicks)
      .values({
        providerId: provider.id,
        corridorId: corridor?.id ?? null,
        amountSent: query.amount ? toMoney(query.amount) : null,
        deliveryMethod: query.method ?? null,
        clickId,
        referrer: request.headers.get('referer'),
        // Preserve campaign attribution without storing anything identifying.
        utm:
          [...url.searchParams.entries()]
            .filter(([key]) => key.startsWith('utm_'))
            .map(([key, value]) => `${key}=${value}`)
            .join('&') || null,
      })
      .returning({ id: affiliateClicks.id })

    // The savings ledger hangs off the click, so it can only be written once
    // the click has an id.
    if (inserted) {
      await recordSaving({
        affiliateClickId: inserted.id,
        providerId: provider.id,
        corridorId: corridor?.id ?? null,
        currency: corridor?.currency ?? null,
        amount: ledgerAmount,
        method: query.method ?? null,
      })
    }
  } catch (error) {
    // Losing a click row is bad for reporting and irrelevant to the user.
    console.error('[go] click logging failed:', error)
  }
}

export async function handleGo(
  request: Request,
  url: URL,
  slug: string,
  ctx: WorkerContext,
): Promise<Response> {
  const parsed = ParamsSchema.safeParse(Object.fromEntries(url.searchParams))
  const query: Query = parsed.success ? parsed.data : {}

  const [provider] = await db.select().from(providers).where(eq(providers.slug, slug)).limit(1)

  if (!provider || !provider.active) return redirect('/providers', url)

  // The benchmark row is not a real product and must never link out.
  if (provider.isBenchmark) return redirect('/how-we-rank#bank-benchmark', url)

  const clickId = crypto.randomUUID()
  if (allow(`go:${clientIp(request)}`, CLICKS_PER_WINDOW, CLICK_WINDOW_MS)) {
    ctx.waitUntil(logClick(request, url, provider, clickId, query))
  }

  const destination = buildAffiliateUrl({
    template: provider.affiliateUrlTemplate,
    homepageUrl: provider.homepageUrl,
    clickId,
  })
  if (!destination) return redirect('/providers', url)

  return new Response(null, {
    status: 302,
    headers: {
      location: destination,
      // Never cache a redirect that mints a per-click tracking id.
      'cache-control': 'no-store, max-age=0',
      // Do not leak the amount someone is sending to the provider's analytics.
      'referrer-policy': 'origin',
    },
  })
}
