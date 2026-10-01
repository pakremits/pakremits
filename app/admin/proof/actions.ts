'use server'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { DELIVERY_METHODS, bankBenchmarks } from '@/lib/db/schema'
import { invalidateProofStats } from '@/lib/proof/stats'

/**
 * Update one bank benchmark by hand.
 *
 * Anything saved here is marked `pinned`, which takes the row out of the weekly
 * cron refresh. That is the point of the form: it exists so a real quote from a
 * named bank can replace a generated approximation, and it would be useless if
 * the next cron pass overwrote it fifteen minutes later.
 */
const BenchmarkSchema = z.object({
  corridorId: z.coerce.number().int().positive(),
  deliveryMethod: z.enum(DELIVERY_METHODS),
  rate: z.coerce.number().positive().max(100_000),
  fee: z.coerce.number().min(0).max(100_000),
  note: z.string().max(500).optional(),
})

export type BenchmarkFormState = { ok: boolean; message: string } | null

export async function updateBenchmark(
  _previous: BenchmarkFormState,
  formData: FormData,
): Promise<BenchmarkFormState> {
  await assertAdmin()
  const parsed = BenchmarkSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid values' }
  }

  const { corridorId, deliveryMethod, rate, fee, note } = parsed.data

  try {
    await db
      .insert(bankBenchmarks)
      .values({
        corridorId,
        deliveryMethod,
        rate: String(rate),
        fee: String(fee),
        note: note?.trim() || null,
        pinned: true,
      })
      .onConflictDoUpdate({
        target: [bankBenchmarks.corridorId, bankBenchmarks.deliveryMethod],
        set: {
          rate: String(rate),
          fee: String(fee),
          note: note?.trim() || null,
          pinned: true,
          updatedAt: new Date(),
        },
      })

    // This figure feeds the public savings total and the methodology table.
    invalidateProofStats()
    revalidatePath('/admin/proof')
    revalidatePath('/how-we-rank')

    return { ok: true, message: 'Benchmark saved and pinned.' }
  } catch (error) {
    console.error('[admin] updateBenchmark failed:', error)
    return { ok: false, message: 'Could not save. See the server log.' }
  }
}

/** Hand a row back to the weekly refresh. */
export async function unpinBenchmark(
  _previous: BenchmarkFormState,
  formData: FormData,
): Promise<BenchmarkFormState> {
  await assertAdmin()
  const corridorId = Number(formData.get('corridorId'))
  const deliveryMethod = String(formData.get('deliveryMethod'))

  if (!Number.isInteger(corridorId) || !DELIVERY_METHODS.includes(deliveryMethod as never)) {
    return { ok: false, message: 'Invalid row' }
  }

  try {
    await db
      .update(bankBenchmarks)
      .set({ pinned: false })
      .where(
        and(
          eq(bankBenchmarks.corridorId, corridorId),
          eq(bankBenchmarks.deliveryMethod, deliveryMethod as (typeof DELIVERY_METHODS)[number]),
        ),
      )

    revalidatePath('/admin/proof')
    return { ok: true, message: 'Unpinned. The next weekly refresh will regenerate it.' }
  } catch (error) {
    console.error('[admin] unpinBenchmark failed:', error)
    return { ok: false, message: 'Could not unpin. See the server log.' }
  }
}
