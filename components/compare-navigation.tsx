'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

/**
 * The Compare button's navigation to /compare, shared by every search form on
 * the page and by the results list.
 *
 * The server answers in well under a second, so the new list used to swap in
 * before the click seemed to register. Every Compare now shows the results
 * skeleton for at least MIN_PENDING_MS:
 *
 * - From another page (the home hero) the push is immediate, so Next shows
 *   /compare's loading.tsx at once; when the page arrives, its list keeps the
 *   skeleton until MIN_PENDING_MS after the click.
 * - On /compare itself only the query string changes, so the old page stays up
 *   while the new one renders; the transition is held open for the minimum and
 *   the list shows the skeleton meanwhile.
 *
 * The transition lives in the provider, not the form, because the forms are
 * keyed on the selection and the phone sheet unmounts its form on close;
 * neither should end the pending state early.
 */

export const MIN_PENDING_MS = 1000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * When the last Compare click that left another page happened. Module state
 * survives the client-side navigation, and a full page load starts at 0, so a
 * reload or shared link never shows the skeleton; otherwise the value simply
 * stops mattering once MIN_PENDING_MS has passed.
 */
let arrivalClickAt = 0

type Navigate = (href: string) => void

const CompareNavigationContext = createContext<{ pending: boolean; navigate: Navigate } | null>(null)

/**
 * For a form outside /compare: push at once and remember when, so /compare can
 * hold its skeleton for the rest of the minimum. `pending` covers the moment
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
    (href: string) => {
      arrivalClickAt = Date.now()
      startTransition(() => router.push(href))
    },
    [router],
  )
  return [pending, navigate]
}

/** Ms left of an arrival's minimum, or 0 when the page was not reached by one. */
function arrivalRemaining(): number {
  return arrivalClickAt ? Math.max(0, arrivalClickAt + MIN_PENDING_MS - Date.now()) : 0
}

export function CompareNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [navigating, startTransition] = useTransition()
  // Read once on mount: the rest of a Compare click's minimum from the home page.
  const [holding, setHolding] = useState(() => arrivalRemaining() > 0)

  // The timestamp is left alone rather than cleared: it runs out by itself,
  // and clearing it here would end the hold on StrictMode's second run.
  useEffect(() => {
    if (!holding) return
    const timer = setTimeout(() => setHolding(false), arrivalRemaining())
    return () => clearTimeout(timer)
  }, [holding])

  // The push starts at once, so a slow server never adds the minimum on top of
  // its own time; the transition ends when both are done.
  const navigate = useCallback(
    (href: string) =>
      startTransition(async () => {
        router.push(href)
        await wait(MIN_PENDING_MS)
      }),
    [router],
  )

  return (
    <CompareNavigationContext.Provider value={{ pending: navigating || holding, navigate }}>
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
