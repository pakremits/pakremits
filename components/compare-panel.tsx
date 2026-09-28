'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { corridorPath } from '@/lib/routes'
import type { Comparison } from '@/lib/quotes'
import type { SortKey } from '@/lib/ranking/rank'
import type { PayoutOption } from '@/components/select-icons'
import { CompareSearch, type SearchCorridorOption, type SearchSelection } from '@/components/compare-search'
import { ResultsSkeleton, ResultsView } from '@/components/compare-results'
import { MIN_PENDING_MS } from '@/components/compare-navigation'
import { PAYOUT_METHOD, initialPayoutOption } from '@/lib/payout'

/**
 * The comparison panel.
 *
 * Server-rendered with real data on first paint, then updated in place from
 * /api/quotes. All ranking and arithmetic stays on the server — this component
 * only renders what it is given, so there is one implementation of the ranking
 * rules rather than two that can drift.
 *
 * It wears the same search bar and result cards as /compare; the difference is
 * that nothing navigates. Editing the form changes nothing until Compare is
 * clicked; then the list shows its skeleton for at least MIN_PENDING_MS (as
 * /compare does) and re-ranks here. A sort change re-fetches too, dimming the
 * list rather than replacing it.
 */

interface Props {
  initial: Comparison
  corridors: SearchCorridorOption[]
  /** Preserve the named account selection when its quote uses the bank rail. */
  initialPayout?: PayoutOption
  /** On a corridor page: picking another country opens that country's page. */
  switchCorridorPages?: boolean
}

/** The old panel's control ids, which deep links and the e2e suite rely on. */
const PANEL_IDS = { from: 'from', method: 'method', amount: 'amt' }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function ComparePanel({ initial, corridors, initialPayout, switchCorridorPages = false }: Props) {
  const t = useTranslations('panel')
  const tm = useTranslations('methods')
  const router = useRouter()
  const locale = useLocale() as Locale

  // The payout the shown results are for: it changes on Compare, not on edit.
  const [payoutOption, setPayoutOption] = useState<PayoutOption>(() =>
    initialPayout ?? initialPayoutOption(initial.deliveryMethod),
  )
  const [sort, setSort] = useState<SortKey>('received')
  const [data, setData] = useState<Comparison>(initial)
  /** A Compare is in flight: the list is a skeleton. */
  const [comparing, setComparing] = useState(false)
  /** A sort change is in flight: the list is dimmed. */
  const [sorting, setSorting] = useState(false)
  const [error, setError] = useState(false)

  const headingId = useId()
  // Lets a slow response from an earlier request lose to a newer one.
  const requestSeq = useRef(0)

  async function load(
    query: { corridor: string; method: string; amount: number; sort: SortKey },
    minimum: number,
  ) {
    const seq = ++requestSeq.current
    setError(false)
    try {
      const params = new URLSearchParams({ ...query, amount: String(query.amount) })
      const [response] = await Promise.all([fetch(`/api/quotes?${params}`), wait(minimum)])
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = (await response.json()) as Comparison
      // A stale response must never overwrite a newer one.
      if (seq === requestSeq.current) setData(payload)
      return seq === requestSeq.current
    } catch {
      if (seq === requestSeq.current) setError(true)
      return false
    }
  }

  async function compare(selection: SearchSelection) {
    const amount = Number.parseFloat(selection.amountText)
    if (!Number.isFinite(amount) || amount <= 0) return
    setComparing(true)
    // A new search starts from the default sort, as a fresh /compare does.
    setSort('received')
    const method = PAYOUT_METHOD[selection.payout]
    if (await load({ corridor: selection.corridor, method, amount, sort: 'received' }, MIN_PENDING_MS)) {
      setPayoutOption(selection.payout)
    }
    setComparing(false)
  }

  async function changeSort(next: SortKey) {
    if (next === sort) return
    setSort(next)
    setSorting(true)
    await load({ corridor: data.corridorSlug, method: data.deliveryMethod, amount: data.amount, sort: next }, 0)
    setSorting(false)
  }

  const payoutLabels: Record<PayoutOption, string> = {
    bank: tm('bank'),
    jazzcash: 'JazzCash',
    easypaisa: 'Easypaisa',
    sadapay: 'SadaPay',
    nayapay: 'NayaPay',
    cash: tm('cash'),
    rda: tm('rda'),
  }

  return (
    <section id="compare" aria-labelledby={headingId} className="relative">
      <h2 id={headingId} className="sr-only">
        {t('heading')}
      </h2>

      <CompareSearch
        corridors={corridors}
        initialCorridor={initial.corridorSlug}
        initialPayout={payoutOption}
        initialAmount={initial.amount}
        layout="row"
        ids={PANEL_IDS}
        onCompare={compare}
        busy={comparing}
        onCorridorChange={
          switchCorridorPages ? (slug) => router.push(corridorPath(slug, locale)) : undefined
        }
      />

      {comparing ? (
        <ResultsSkeleton className="mt-12" showCapturedAt />
      ) : (
        <ResultsView
          data={data}
          sort={sort}
          onSort={changeSort}
          pending={sorting}
          error={error}
          payout={payoutOption}
          payoutLabel={payoutLabels[payoutOption]}
          className="mt-12"
          showCapturedAt
        />
      )}
    </section>
  )
}
