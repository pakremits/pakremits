/**
 * Alert evaluation, run after every rate refresh.
 *
 * ## Which rate triggers an alert
 *
 * The obvious answer is the mid-market rate, and it is wrong. Nobody can
 * obtain the mid-market rate, so an alert that fires when it crosses 380 tells
 * the recipient to act on a number they cannot get — and the message would
 * then have to say "crossed 380, best available 378.90", which is the
 * inconsistency the design mock itself shows.
 *
 * So alerts trigger on the best rate actually obtainable at that moment: the
 * top row of the comparison table for that corridor. The message is then
 * internally consistent, and "tell me when the pound hits 380" means what a
 * sender thinks it means.
 *
 * If no provider quote exists for a corridor we do not fall back to
 * mid-market — we simply do not fire. A misleading alert is worse than a late
 * one.
 */
import { and, eq, lt } from 'drizzle-orm'
import { db, toNum } from '@/lib/db'
import { type SendCurrency, rateAlerts } from '@/lib/db/schema'
import { CURRENCY_SYMBOLS, corridorByCurrency } from '@/lib/corridors'
import { getComparison, getMidMarketSeries } from '@/lib/quotes'
import { send } from '@/lib/notify'
import { composeDigestMessage, composeTriggerMessage } from './messages'
import { decideTrigger, digestDue } from './decide'

export interface EvaluationResult {
  considered: number
  fired: number
  digestsSent: number
  failed: number
  /** Counts by non-firing reason, so /admin can explain a quiet day. */
  skipped: Record<string, number>
  errors: string[]
}

/** The obtainable-rate snapshot for one currency, fetched once per run. */
interface CurrencySnapshot {
  currentRate: number | null
  bestProviderName: string | null
  bestProviderSlug: string | null
  amountSent: number
  amountReceived: number
  savingVsBank: number | null
  highestInDays: number | null
  weekChangePercent: number | null
}

async function snapshotFor(currency: SendCurrency): Promise<CurrencySnapshot> {
  const corridor = corridorByCurrency(currency)
  const empty: CurrencySnapshot = {
    currentRate: null,
    bestProviderName: null,
    bestProviderSlug: null,
    amountSent: 0,
    amountReceived: 0,
    savingVsBank: null,
    highestInDays: null,
    weekChangePercent: null,
  }
  if (!corridor) return empty

  const [comparison, series] = await Promise.all([
    getComparison({ corridorSlug: corridor.slug, method: 'bank' }).catch(() => null),
    getMidMarketSeries(currency, 31).catch(() => null),
  ])

  const best = comparison?.rows.find((row) => row.isBest)
  if (!best || !comparison) return empty

  // "Highest rate in N days" is only claimed when the trailing series actually
  // supports it — see the rate page for the same rule about window coverage.
  let highestInDays: number | null = null
  if (series && series.points.length > 2) {
    const highest = Math.max(...series.points.map((p) => p.rate))
    const days = Math.round(
      (series.points[series.points.length - 1].date.getTime() - series.points[0].date.getTime()) /
        86_400_000,
    )
    if (best.quote.rate >= highest && days >= 7) highestInDays = days
  }

  return {
    currentRate: best.quote.rate,
    bestProviderName: best.quote.providerName,
    bestProviderSlug: best.quote.providerSlug,
    amountSent: comparison.amount,
    amountReceived: best.quote.amountReceived,
    savingVsBank: comparison.savingVsBank,
    highestInDays,
    weekChangePercent: series?.changePercent ?? null,
  }
}

/**
 * Evaluate every live alert and send what is due.
 *
 * Nothing throws past this function — the cron route treats a failure here as
 * a warning, because losing an alert must not lose the rate refresh that
 * preceded it.
 */
export async function evaluateAlerts(now: Date = new Date()): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    considered: 0,
    fired: 0,
    digestsSent: 0,
    failed: 0,
    skipped: {},
    errors: [],
  }

  const bump = (reason: string) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1
  }

  let alerts: (typeof rateAlerts.$inferSelect)[]
  try {
    alerts = await db.select().from(rateAlerts).where(eq(rateAlerts.active, true))
  } catch (error) {
    result.errors.push(`could not load alerts: ${error instanceof Error ? error.message : error}`)
    return result
  }

  result.considered = alerts.length
  if (alerts.length === 0) return result

  // One snapshot per currency, not per alert — 500 alerts on GBP must not mean
  // 500 comparison queries.
  const currencies = [...new Set(alerts.map((a) => a.fromCurrency))]
  const snapshots = new Map<SendCurrency, CurrencySnapshot>()
  for (const currency of currencies) {
    try {
      snapshots.set(currency, await snapshotFor(currency))
    } catch (error) {
      // No snapshot means decideTrigger sees a null rate and returns
      // 'no-rate-available', which is the correct outcome: we do not guess.
      result.errors.push(`snapshot ${currency}: ${error instanceof Error ? error.message : error}`)
    }
  }

  for (const alert of alerts) {
    const snapshot = snapshots.get(alert.fromCurrency)
    const currentRate = snapshot?.currentRate ?? null

    const decision = decideTrigger(
      {
        direction: alert.direction,
        targetRate: toNum(alert.targetRate),
        active: alert.active,
        confirmed: alert.confirmed,
        channel: alert.channel,
        lastTriggeredAt: alert.lastTriggeredAt,
      },
      currentRate,
      now,
    )

    if (decision.fire && snapshot?.bestProviderSlug && snapshot.bestProviderName) {
      const message = composeTriggerMessage(
        {
          fromCurrency: alert.fromCurrency,
          targetRate: toNum(alert.targetRate),
          direction: alert.direction,
          currentRate: snapshot.currentRate!,
          bestProviderName: snapshot.bestProviderName,
          bestProviderSlug: snapshot.bestProviderSlug,
          amountSent: snapshot.amountSent,
          currencySymbol: CURRENCY_SYMBOLS[alert.fromCurrency],
          amountReceived: snapshot.amountReceived,
          savingVsBank: snapshot.savingVsBank,
          highestInDays: snapshot.highestInDays,
          token: alert.unsubscribeToken,
        },
        alert.channel,
      )

      const sent = await send({
        to: alert.userContact,
        channel: alert.channel,
        subject: message.subject,
        text: message.text,
        ...('html' in message ? { html: message.html, headers: message.headers } : {}),
      })

      if (sent.ok) {
        // Recorded even for a simulated send, otherwise local runs would fire
        // the same alert every 15 minutes forever.
        await db
          .update(rateAlerts)
          .set({ lastTriggeredAt: now })
          .where(eq(rateAlerts.id, alert.id))
          .catch((error) => result.errors.push(`trigger write failed: ${error}`))
        result.fired += 1
      } else {
        result.failed += 1
        result.errors.push(`alert ${alert.id} (${alert.channel}): ${sent.error}`)
      }
    } else if (!decision.fire) {
      bump(decision.reason)
    }

    // Digest runs on its own clock, so a rate-limited alert can still receive
    // its weekly summary.
    if (
      alert.channel === 'email' &&
      digestDue(
        {
          active: alert.active,
          confirmed: alert.confirmed,
          wantsDigest: alert.wantsDigest,
          lastDigestAt: alert.lastDigestAt,
        },
        now,
      ) &&
      snapshot?.currentRate
    ) {
      const digest = composeDigestMessage({
        fromCurrency: alert.fromCurrency,
        currentRate: snapshot.currentRate,
        weekChangePercent: snapshot.weekChangePercent,
        bestProviderName: snapshot.bestProviderName,
        token: alert.unsubscribeToken,
      })

      const sent = await send({
        to: alert.userContact,
        channel: 'email',
        subject: digest.subject,
        text: digest.text,
        html: digest.html,
        headers: digest.headers,
      })

      if (sent.ok) {
        await db
          .update(rateAlerts)
          .set({ lastDigestAt: now })
          .where(eq(rateAlerts.id, alert.id))
          .catch((error) => result.errors.push(`digest write failed: ${error}`))
        result.digestsSent += 1
      } else {
        result.failed += 1
      }
    }
  }

  return result
}

/**
 * Delete unconfirmed email alerts older than 48 hours.
 *
 * The confirmation email promises this ("the unconfirmed alert is deleted
 * automatically") and the privacy policy promises we do not sit on contact
 * details we have no consent to use. Both are only true if this actually runs.
 */
export async function pruneUnconfirmedAlerts(hours = 48): Promise<number> {
  const deleted = await db
    .delete(rateAlerts)
    .where(
      and(
        eq(rateAlerts.channel, 'email'),
        eq(rateAlerts.confirmed, false),
        lt(rateAlerts.createdAt, new Date(Date.now() - hours * 3_600_000)),
      ),
    )
    .returning({ id: rateAlerts.id })

  return deleted.length
}
