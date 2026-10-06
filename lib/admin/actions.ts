/**
 * What the admin forms do, as plain functions over the form fields.
 *
 * These were Next server actions. The site is static now, so the Worker runs
 * them behind /admin/api/* (worker/admin.ts), after the same password check
 * as every admin page. Each one validates, writes D1 and answers in the shape
 * the forms render: `{ ok, message }`.
 *
 * Changes reach the public pages at the next build: the daily one, or at once
 * with Publish now.
 */
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { validateAffiliateTemplate } from '@/lib/admin/affiliate'
import { db, toMoney, toRate } from '@/lib/db'
import { DELIVERY_METHODS, bankBenchmarks, providers } from '@/lib/db/schema'
import { applyQuoteChanges } from '@/lib/quotes-write'
import { computeReceived } from '@/lib/ranking/compute'

export type ActionResult = { ok: boolean; message: string }

type Fields = Record<string, unknown>

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  return issue ? `${issue.path.join('.') || 'value'}: ${issue.message}` : 'Check the values.'
}

/* ── Bank benchmarks ───────────────────────────────────────────────────── */

/**
 * Anything saved here is marked `pinned`, which takes the row out of the
 * weekly refresh. That is the point of the form: it exists so a real quote
 * from a named bank can replace a generated approximation, and it would be
 * useless if the next refresh overwrote it.
 */
const BenchmarkSchema = z.object({
  corridorId: z.coerce.number().int().positive(),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  rate: z.coerce.number().positive().max(100_000),
  fee: z.coerce.number().min(0).max(100_000),
  note: z.string().max(500).optional(),
})

export async function saveBenchmark(fields: Fields): Promise<ActionResult> {
  const parsed = BenchmarkSchema.safeParse(fields)
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }

  const { corridorId, deliveryMethod, rate, fee, note } = parsed.data
  const values = { rate: toRate(rate), fee: toMoney(fee), note: note?.trim() || null, pinned: true }

  try {
    await db
      .insert(bankBenchmarks)
      .values({ corridorId, deliveryMethod, ...values })
      .onConflictDoUpdate({
        target: [bankBenchmarks.corridorId, bankBenchmarks.deliveryMethod],
        set: { ...values, updatedAt: new Date() },
      })
    return { ok: true, message: 'Benchmark saved and pinned. It goes live at the next build.' }
  } catch (error) {
    console.error('[admin] saveBenchmark failed:', error)
    return { ok: false, message: 'Could not save. See the Worker log.' }
  }
}

/** Hand a row back to the weekly refresh. */
export async function unpinBenchmark(fields: Fields): Promise<ActionResult> {
  const parsed = BenchmarkSchema.pick({ corridorId: true, deliveryMethod: true }).safeParse(fields)
  if (!parsed.success) return { ok: false, message: 'Invalid row' }

  try {
    await db
      .update(bankBenchmarks)
      .set({ pinned: false })
      .where(
        and(
          eq(bankBenchmarks.corridorId, parsed.data.corridorId),
          eq(bankBenchmarks.deliveryMethod, parsed.data.deliveryMethod),
        ),
      )
    return { ok: true, message: 'Unpinned. The next weekly refresh will regenerate it.' }
  } catch (error) {
    console.error('[admin] unpinBenchmark failed:', error)
    return { ok: false, message: 'Could not unpin. See the Worker log.' }
  }
}

/* ── Providers ─────────────────────────────────────────────────────────── */

/**
 * Monetisation settings: the only provider fields the seed deliberately does
 * not overwrite, because they are set here and must survive a reseed.
 */
const TemplateSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  affiliateNetwork: z.enum(['impact', 'cj', 'partnerize', 'direct', 'none']),
  affiliateUrlTemplate: z.string().trim().max(1000),
  commissionNote: z.string().trim().max(300),
})

export async function saveAffiliateSettings(fields: Fields): Promise<ActionResult> {
  const parsed = TemplateSchema.safeParse(fields)
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }

  const { providerId, affiliateNetwork, affiliateUrlTemplate, commissionNote } = parsed.data
  const check = validateAffiliateTemplate(affiliateUrlTemplate)
  if (!check.ok) return { ok: false, message: check.message }

  const template = affiliateUrlTemplate || null
  try {
    await db
      .update(providers)
      .set({ affiliateNetwork, affiliateUrlTemplate: template, commissionNote: commissionNote || null })
      .where(eq(providers.id, providerId))
  } catch (error) {
    console.error('[admin] saveAffiliateSettings failed:', error)
    return { ok: false, message: 'Could not save. See the Worker log.' }
  }

  return {
    ok: true,
    message: template
      ? 'Saved. Clicks carry tracking from now on.'
      : 'Saved. This provider earns nothing.',
  }
}

/**
 * Set the single featured (sponsored) provider, or none.
 *
 * At most one at a time, because the ranking pins the featured row to exactly
 * one position — directly below the best deal. Two featured providers would
 * make the second one's placement silently arbitrary, so setting one clears
 * the rest rather than leaving that ambiguity in the data.
 */
export async function setFeaturedProvider(fields: Fields): Promise<ActionResult> {
  const raw = String(fields.providerId ?? '')
  const providerId = raw === 'none' ? null : Number.parseInt(raw, 10)
  if (providerId !== null && !Number.isInteger(providerId)) {
    return { ok: false, message: 'Pick a provider, or none.' }
  }

  try {
    if (providerId === null) {
      await db.update(providers).set({ featured: false }).where(eq(providers.featured, true))
    } else {
      // One batch, so there is never a moment with two featured rows.
      await db.batch([
        db.update(providers).set({ featured: false }).where(ne(providers.id, providerId)),
        db.update(providers).set({ featured: true }).where(eq(providers.id, providerId)),
      ])
    }
    return { ok: true, message: providerId === null ? 'No sponsored row.' : 'Sponsored provider set.' }
  } catch (error) {
    console.error('[admin] setFeaturedProvider failed:', error)
    return { ok: false, message: 'Could not save. See the Worker log.' }
  }
}

/* ── Manual quotes ─────────────────────────────────────────────────────── */

/**
 * The escape hatch for when an adapter starts returning a wrong number at the
 * worst possible moment. Rows written here are marked `source: 'manual'` so
 * the provenance is visible in /admin and never mistaken for live data.
 *
 * Named account destinations use bank-deposit quotes in the public
 * comparison; overrides here remain provider quotes, not account-specific
 * rates.
 */
const OverrideSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  corridorId: z.coerce.number().int().positive(),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  amountSent: z.coerce.number().positive().max(1_000_000),
  rate: z.coerce.number().positive().max(10_000),
  fee: z.coerce.number().min(0).max(100_000),
  deliverySpeedText: z.string().min(1).max(60),
  deliverySpeedMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30).optional(),
  promoNote: z.string().max(120).optional(),
})

export async function saveManualQuote(fields: Fields): Promise<ActionResult> {
  // An empty optional field arrives as "", which coerces to 0 minutes.
  const cleaned = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ''))
  const parsed = OverrideSchema.safeParse(cleaned)
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) }

  const input = parsed.data
  // Same canonical model the adapters use, so a manual row is directly
  // comparable with a live one rather than being computed a second way.
  const amountReceived = computeReceived(input.amountSent, input.rate, input.fee, 'deducted')
  if (amountReceived <= 0) {
    return { ok: false, message: 'That fee is larger than the amount sent — nothing would arrive.' }
  }

  try {
    // Through the same writer as the refresh, so the quote shows on the site
    // (latest_quotes) as well as in the history.
    await applyQuoteChanges([
      {
        kind: 'fresh',
        quote: {
          providerId: input.providerId,
          corridorId: input.corridorId,
          deliveryMethod: input.deliveryMethod,
          amountSent: input.amountSent,
          rate: input.rate,
          fee: input.fee,
          amountReceived,
          deliverySpeedText: input.deliverySpeedText,
          deliverySpeedMinutes: input.deliverySpeedMinutes ?? null,
          promoFlag: Boolean(input.promoNote),
          promoNote: input.promoNote || null,
          source: 'manual',
          capturedAt: new Date(),
        },
      },
    ])
  } catch (error) {
    console.error('[admin] saveManualQuote failed:', error)
    return { ok: false, message: 'Could not save. See the Worker log.' }
  }

  return {
    ok: true,
    message: `Saved. Recipient gets ₨ ${amountReceived.toLocaleString('en-PK')}; it goes live at the next build.`,
  }
}
