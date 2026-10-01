'use server'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { DELIVERY_METHODS, corridors, providers, rateQuotes } from '@/lib/db/schema'
import { computeReceived } from '@/lib/ranking/compute'

/**
 * Manual quote override.
 *
 * The escape hatch for when an adapter starts returning a wrong number at the
 * worst possible moment. Rows written here are marked `source: 'manual'` so the
 * provenance is visible in /admin and never mistaken for live data.
 *
 * Named account destinations use bank-deposit quotes in the public comparison;
 * overrides here remain provider quotes, not account-specific rates.
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

export type OverrideState = { ok: boolean; message: string } | null

export async function saveManualQuote(
  _previous: OverrideState,
  formData: FormData,
): Promise<OverrideState> {
  await assertAdmin()
  const parsed = OverrideSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, message: `${first.path.join('.')}: ${first.message}` }
  }

  const input = parsed.data

  // Same canonical model the adapters use, so a manual row is directly
  // comparable with a live one rather than being computed a second way.
  const amountReceived = computeReceived(input.amountSent, input.rate, input.fee, 'deducted')

  if (amountReceived <= 0) {
    return { ok: false, message: 'That fee is larger than the amount sent — nothing would arrive.' }
  }

  try {
    await db.insert(rateQuotes).values({
      providerId: input.providerId,
      corridorId: input.corridorId,
      deliveryMethod: input.deliveryMethod,
      amountSent: String(input.amountSent),
      rate: String(input.rate),
      fee: String(input.fee),
      amountReceived: String(amountReceived),
      deliverySpeedText: input.deliverySpeedText,
      deliverySpeedMinutes: input.deliverySpeedMinutes ?? null,
      promoFlag: Boolean(input.promoNote),
      promoNote: input.promoNote || null,
      source: 'manual',
      stale: false,
      capturedAt: new Date(),
    })
  } catch (error) {
    console.error('[admin] manual quote insert failed:', error)
    return { ok: false, message: 'Could not save. Check the server logs.' }
  }

  revalidatePath('/admin/quotes')
  revalidatePath('/')

  return {
    ok: true,
    message: `Saved. Recipient gets ₨ ${amountReceived.toLocaleString('en-PK')}.`,
  }
}

/** Options for the override form's selects. */
export async function getFormOptions() {
  await assertAdmin()
  const [providerRows, corridorRows] = await Promise.all([
    db.select({ id: providers.id, name: providers.name }).from(providers).orderBy(providers.name),
    db
      .select({ id: corridors.id, name: corridors.fromCountryName, currency: corridors.fromCurrency })
      .from(corridors)
      .orderBy(corridors.fromCountryName),
  ])
  return { providers: providerRows, corridors: corridorRows }
}
