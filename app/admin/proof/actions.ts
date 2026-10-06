/**
 * The benchmark form's actions: posts to the Worker (lib/admin/actions.ts
 * does the work), in the shape useActionState expects.
 */
import { type FormState, postAdminForm } from '@/lib/admin/client'

export type BenchmarkFormState = FormState

export function updateBenchmark(_previous: FormState, formData: FormData): Promise<FormState> {
  return postAdminForm('benchmarks', formData)
}

/** Hand a row back to the weekly refresh. */
export function unpinBenchmark(_previous: FormState, formData: FormData): Promise<FormState> {
  return postAdminForm('benchmarks/unpin', formData)
}
