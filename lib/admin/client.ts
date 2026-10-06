/**
 * The admin pages' side of /admin/api (worker/admin.ts).
 *
 * The pages are static files, so each loads its data with `useAdminData` and
 * each form posts with `postAdminForm`, which answers in the `{ ok, message }`
 * shape the forms already render. A successful save tells every
 * `useAdminData` on the page to load again, which is what revalidatePath did
 * when these were server actions.
 */
import { useEffect, useState } from 'react'

export type FormState = { ok: boolean; message: string } | null

const CHANGED = 'pakremits:admin-changed'

export async function postAdminForm(name: string, formData: FormData): Promise<FormState> {
  try {
    const response = await fetch(`/admin/api/${name}`, { method: 'POST', body: formData })
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      message?: string
      error?: string
    }
    if (result.ok) window.dispatchEvent(new Event(CHANGED))
    return {
      ok: Boolean(result.ok),
      message: result.message ?? result.error ?? `The server answered HTTP ${response.status}.`,
    }
  } catch {
    return { ok: false, message: 'Could not reach the server. Check the connection and try again.' }
  }
}

/** A page's data from /admin/api/{name}; loaded again after every successful save. */
export function useAdminData<T>(name: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({
    data: null,
    error: null,
  })

  useEffect(() => {
    let current = true
    const load = () => {
      fetch(`/admin/api/${name}`, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return (await response.json()) as T
        })
        .then((data) => current && setState({ data, error: null }))
        .catch((error: unknown) =>
          current &&
          setState((previous) => ({
            data: previous.data,
            error: error instanceof Error ? error.message : String(error),
          })),
        )
    }
    load()
    window.addEventListener(CHANGED, load)
    return () => {
      current = false
      window.removeEventListener(CHANGED, load)
    }
  }, [name])

  return state
}
