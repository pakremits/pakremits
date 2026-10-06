/**
 * The manual quote form's action: posts to the Worker (lib/admin/actions.ts
 * does the work), in the shape useActionState expects.
 */
import { type FormState, postAdminForm } from '@/lib/admin/client'

export type OverrideState = FormState

export function saveManualQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  return postAdminForm('quotes', formData)
}
