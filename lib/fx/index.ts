/**
 * Mid-market reference rates — the line every provider is measured against.
 *
 * Why not Frankfurter: it is ECB-only and the ECB does not publish PKR, so
 * Frankfurter has no PKR at any endpoint.
 * Why not exchangerate.host: the free tier is 100 requests/month and does not
 * serve HTTPS, both disqualifying for a 15-minute refresh.
 *
 * Wise's public rates endpoints need no key, cover every corridor we run, and —
 * uniquely among the free options — return daily history, which is what the
 * corridor-page sparklines and the "highest rate in 31 days" alert copy need.
 * `open.er-api.com` sits behind the same interface as a fallback.
 */
import type { SendCurrency } from '@/lib/db/schema'
import { AdapterError, fetchJson } from '@/lib/providers/types'

export interface FxRate {
  fromCurrency: SendCurrency
  toCurrency: 'PKR'
  rate: number
  capturedAt: Date
  source: string
}

export interface FxHistoryPoint {
  date: Date
  rate: number
}

export interface FxSource {
  name: string
  getRate(from: SendCurrency): Promise<FxRate>
  /** Daily closes, oldest first. Used for the 7/30/90-day sparklines. */
  getHistory(from: SendCurrency, days: number): Promise<FxHistoryPoint[]>
}

interface WiseRatePoint {
  source: string
  target: string
  value: number
  /** Epoch milliseconds. */
  time: number
}

/**
 * Primary source: wise.com/rates. Unauthenticated, no key, no quota published.
 * We call it once per currency per refresh — 8 requests every 15 minutes.
 */
export const wiseFxSource: FxSource = {
  name: 'wise',

  async getRate(from) {
    const url = `https://wise.com/rates/live?source=${from}&target=PKR`
    const point = await fetchJson<WiseRatePoint>(url, { providerSlug: 'fx:wise' })

    if (!Number.isFinite(point?.value) || point.value <= 0) {
      throw new AdapterError('fx:wise', `bad rate for ${from}: ${point?.value}`)
    }

    return {
      fromCurrency: from,
      toCurrency: 'PKR',
      rate: point.value,
      capturedAt: new Date(point.time),
      source: 'wise',
    }
  },

  async getHistory(from, days) {
    // The day unit stops at 31 (a longer length is a 400); months reach a
    // year, so a longer span is asked for in months and trimmed to `days`.
    const byMonth = days > 31
    const span = byMonth
      ? `length=${Math.min(Math.ceil(days / 30), 12)}&resolution=daily&unit=month`
      : `length=${days}&resolution=daily&unit=day`
    const url = `https://wise.com/rates/history+live?source=${from}&target=PKR&${span}`
    const points = await fetchJson<WiseRatePoint[]>(url, { providerSlug: 'fx:wise' })

    if (!Array.isArray(points) || points.length === 0) {
      throw new AdapterError('fx:wise', `no history for ${from}`)
    }

    const cutoff = byMonth ? Date.now() - days * 86_400_000 : -Infinity
    return points
      .filter((p) => Number.isFinite(p.value) && p.value > 0 && p.time >= cutoff)
      .map((p) => ({ date: new Date(p.time), rate: p.value }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  },
}

interface ErApiResponse {
  result: string
  rates: Record<string, number>
  time_last_update_unix: number
}

/**
 * Fallback source: open.er-api.com. No key, one call covers all eight
 * currencies, but it updates only once a day and serves no history.
 *
 * Attribution is a condition of the open endpoint — the footer carries the
 * "Rates by ExchangeRate-API" link whenever this source is in use.
 * @see https://www.exchangerate-api.com/docs/free
 */
export const erApiFxSource: FxSource = {
  name: 'open.er-api.com',

  async getRate(from) {
    const payload = await fetchJson<ErApiResponse>(
      `https://open.er-api.com/v6/latest/${from}`,
      { providerSlug: 'fx:er-api' },
    )

    const rate = payload?.rates?.PKR
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new AdapterError('fx:er-api', `no PKR rate for ${from}`)
    }

    return {
      fromCurrency: from,
      toCurrency: 'PKR',
      rate,
      capturedAt: new Date(payload.time_last_update_unix * 1000),
      source: 'open.er-api.com',
    }
  },

  async getHistory() {
    // The open endpoint has no history route. Callers fall back to our own
    // stored mid_market_rates, which is why the seed lays down 30 days.
    throw new AdapterError('fx:er-api', 'history is not available on the open endpoint')
  },
}

const SOURCES: readonly FxSource[] = [wiseFxSource, erApiFxSource]

/**
 * Try each source in order and return the first that answers.
 *
 * Throws only when every source fails, which the cron route treats as a
 * non-fatal warning — provider quotes still refresh without a mid-market line.
 */
export async function getMidMarketRate(from: SendCurrency): Promise<FxRate> {
  const errors: string[] = []

  for (const source of SOURCES) {
    try {
      return await source.getRate(from)
    } catch (error) {
      errors.push(`${source.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new AdapterError('fx', `every source failed for ${from} — ${errors.join('; ')}`)
}

export async function getMidMarketHistory(
  from: SendCurrency,
  days = 30,
): Promise<FxHistoryPoint[]> {
  return wiseFxSource.getHistory(from, days)
}
