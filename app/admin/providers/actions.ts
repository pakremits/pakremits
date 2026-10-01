'use server'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { providers } from '@/lib/db/schema'
import { validateAffiliateTemplate } from '@/lib/admin/affiliate'

/**
 * Monetisation settings.
 *
 * These are the only fields the seed deliberately does not overwrite, because
 * they are set here in production and must survive a reseed.
 */
export type SettingsState = { ok: boolean; message: string } | null

const TemplateSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  affiliateNetwork: z.enum(['impact', 'cj', 'partnerize', 'direct', 'none']),
  affiliateUrlTemplate: z.string().trim().max(1000),
  commissionNote: z.string().trim().max(300),
})

export async function saveAffiliateSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await assertAdmin()
  const parsed = TemplateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the values.' }
  }

  const { providerId, affiliateNetwork, affiliateUrlTemplate, commissionNote } = parsed.data
  const template = affiliateUrlTemplate || null

  const check = validateAffiliateTemplate(affiliateUrlTemplate)
  if (!check.ok) return { ok: false, message: check.message }

  try {
    await db
      .update(providers)
      .set({
        affiliateNetwork,
        affiliateUrlTemplate: template,
        commissionNote: commissionNote || null,
      })
      .where(eq(providers.id, providerId))
  } catch (error) {
    console.error('[admin] affiliate settings failed:', error)
    return { ok: false, message: 'Could not save. Check the server logs.' }
  }

  revalidatePath('/admin/providers')
  revalidatePath('/')

  return {
    ok: true,
    message: template ? 'Saved. Clicks will now carry tracking.' : 'Saved. This provider earns nothing.',
  }
}

/**
 * Set the single featured (sponsored) provider.
 *
 * At most one at a time, because the ranking pins the featured row to exactly
 * one position — directly below the best deal. Two featured providers would
 * make the second one's placement silently arbitrary, so setting one clears
 * the rest rather than leaving that ambiguity in the data.
 */
export async function setFeatured(formData: FormData): Promise<void> {
  await assertAdmin()
  const raw = String(formData.get('providerId') ?? '')
  const providerId = raw === 'none' ? null : Number.parseInt(raw, 10)

  try {
    if (providerId === null || !Number.isInteger(providerId)) {
      await db.update(providers).set({ featured: false }).where(eq(providers.featured, true))
    } else {
      await db.update(providers).set({ featured: false }).where(ne(providers.id, providerId))
      await db.update(providers).set({ featured: true }).where(eq(providers.id, providerId))
    }
  } catch (error) {
    console.error('[admin] setFeatured failed:', error)
  }

  revalidatePath('/admin/providers')
  revalidatePath('/')
}
