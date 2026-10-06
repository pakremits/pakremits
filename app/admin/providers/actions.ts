/**
 * The provider forms' actions: posts to the Worker (lib/admin/actions.ts does
 * the work), in the shapes the forms expect.
 */
import { type FormState, postAdminForm } from '@/lib/admin/client'

export type SettingsState = FormState

export function saveAffiliateSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  return postAdminForm('providers/affiliate', formData)
}

/** Set the single featured (sponsored) provider, or none. */
export async function setFeatured(formData: FormData): Promise<void> {
  const result = await postAdminForm('providers/featured', formData)
  if (!result?.ok) window.alert(result?.message ?? 'Could not save.')
}
