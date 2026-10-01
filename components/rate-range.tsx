'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { RangeKey } from '@/lib/rate-ranges'

/**
 * Shares the selected chart range across a page, so the rate page's banner
 * line follows the range picked on the chart below it. Without a provider the
 * chart keeps its own range.
 */
const RateRangeContext = createContext<{ range: RangeKey; setRange: (range: RangeKey) => void } | null>(null)

export function RateRangeProvider({ initial, children }: { initial: RangeKey; children: ReactNode }) {
  const [range, setRange] = useState<RangeKey>(initial)
  return <RateRangeContext.Provider value={{ range, setRange }}>{children}</RateRangeContext.Provider>
}

export function useSharedRateRange() {
  return useContext(RateRangeContext)
}
