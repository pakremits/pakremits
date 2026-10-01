'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useTransition,
  type ReactNode,
} from 'react'

/**
 * The Compare button's navigation to /compare, shared by every search form on
 * the page and by the results list.
 *
 * The skeleton shows for exactly as long as the new results take, never
 * longer: `router.push` inside a transition keeps it pending until the new
 * page has rendered.
 *
 * - From another page (the home hero) the push is immediate, so Next shows
 *   /compare's loading.tsx at once.
 * - On /compare itself only the query string changes, so the old page stays up
 *   while the new one renders, and the list shows the skeleton meanwhile.
 *
 * The transition lives in the provider, not the form, because the forms are
 * keyed on the selection and the phone sheet unmounts its form on close;
 * neither should end the pending state early.
 */

type Navigate = (href: string) => void

const CompareNavigationContext = createContext<{ pending: boolean; navigate: Navigate } | null>(null)

/**
 * For a form outside /compare: push at once. `pending` covers the moment
 * before loading.tsx replaces the page.
 */
export function useArrivalNavigation(
  /** Any /compare URL, prefetched so the loading state is already on hand. */
  prefetchHref: string | null,
): [pending: boolean, navigate: Navigate] {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // /compare is dynamic, so this fetches only down to its loading.tsx, which
  // is the same for every query; the click then swaps it in without a wait.
  useEffect(() => {
    if (prefetchHref) router.prefetch(prefetchHref)
  }, [router, prefetchHref])
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  )
  return [pending, navigate]
}

export function CompareNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [navigating, startTransition] = useTransition()

  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  )

  return (
    <CompareNavigationContext.Provider value={{ pending: navigating, navigate }}>
      {children}
    </CompareNavigationContext.Provider>
  )
}

/** Null outside a provider (the home page), where a form navigates on its own. */
export function useCompareNavigation() {
  return useContext(CompareNavigationContext)
}

/** Swaps its children for `fallback` while a Compare is pending. */
export function WhileComparing({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return useCompareNavigation()?.pending ? fallback : children
}
