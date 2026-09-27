import type { Channel } from '@/lib/notify'
import type { SendCurrency } from '@/lib/db/schema'
import { formatPkr } from '@/lib/ranking/compute'
import { formatSend } from '@/lib/corridors'
import { renderAlertEmail, unsubscribeHeaders } from './email-template'

/**
 * Alert message composition.
 *
 * Every message carries three things, in this order: what happened, who is
 * best right now, and a link. That order is deliberate — the recipient is
 * standing in a shop deciding whether to act, and the number is the point.
 *
 * Kept free of I/O so the exact wording is unit-testable. Copy rules apply:
 * sentence case, PKR with the symbol and thousands separators, no marketing
 * filler, and every figure passed in rather than hard-coded.
 */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must be configured to send alert links')
  }
  return 'http://localhost:3000'
}

export interface AlertContext {
  fromCurrency: SendCurrency
  targetRate: number
  direction: 'above' | 'below'
  /** Best rate actually obtainable right now. */
  currentRate: number
  bestProviderName: string
  bestProviderSlug: string
  amountSent: number
  currencySymbol: string
  amountReceived: number
  /** PKR beaten against the bank benchmark, when we have one. */
  savingVsBank: number | null
  /** Highest rate seen in the trailing window, for the "best in N days" line. */
  highestInDays: number | null
  token: string
}

/** Affiliate link, tagged so alert conversions are separable in reporting. */
function goLink(context: AlertContext): string {
  return (
    `${siteUrl()}/go/${context.bestProviderSlug}` +
    `?amount=${context.amountSent}&method=bank&utm_source=alert&utm_medium=${'email'}`
  )
}

export function composeTriggerMessage(context: AlertContext, channel: Channel) {
  const crossed = context.direction === 'above' ? 'crossed' : 'dropped below'

  const headline =
    `${context.fromCurrency} → PKR just ${crossed} ${context.targetRate.toFixed(2)}.`

  const best =
    `Best right now: ${context.bestProviderName} at ${context.currentRate.toFixed(2)}, ` +
    `${formatSend(context.currencySymbol, context.amountSent)} lands as ` +
    `${formatPkr(context.amountReceived)}.`

  const context_lines = [
    context.highestInDays !== null
      ? `This is the highest rate in ${context.highestInDays} days.`
      : null,
    context.savingVsBank !== null
      ? `That is ${formatPkr(context.savingVsBank)} more than a typical high-street bank.`
      : null,
  ].filter(Boolean) as string[]

  // WhatsApp and SMS are read on a lock screen; keep them to the three facts
  // and one link. Email can carry the extra context and the manage link.
  if (channel !== 'email') {
    return {
      subject: headline,
      text: [headline, best, goLink(context)].join(' '),
    }
  }

  return {
    subject: `${context.fromCurrency} → PKR is at ${context.currentRate.toFixed(2)}`,
    text: [
      headline,
      '',
      best,
      ...(context_lines.length ? ['', ...context_lines] : []),
      '',
      `Send now: ${goLink(context)}`,
      '',
      'Quotes move. The provider confirms the final rate before you pay.',
      '',
      `Manage or stop this alert: ${siteUrl()}/alerts/manage/${context.token}`,
      `Unsubscribe in one click: ${siteUrl()}/alerts/unsubscribe/${context.token}`,
    ].join('\n'),
    html: renderAlertEmail({
      homeUrl: siteUrl(),
      preview: headline,
      label: 'Rate alert',
      title: headline,
      body: best,
      facts: [
        { label: 'Target rate', value: context.targetRate.toFixed(2) },
        { label: 'Best provider', value: context.bestProviderName },
        { label: 'Recipient gets', value: formatPkr(context.amountReceived) },
      ],
      action: { label: 'See this rate', url: goLink(context) },
      note: 'Quotes can change. The provider confirms the final rate before you pay.',
      manageUrl: `${siteUrl()}/alerts/manage/${context.token}`,
      unsubscribeUrl: `${siteUrl()}/alerts/unsubscribe/${context.token}`,
    }),
    headers: unsubscribeHeaders(`${siteUrl()}/alerts/unsubscribe/${context.token}`),
  }
}

/** Double opt-in email. Deliberately short — it has exactly one job. */
export function composeConfirmMessage(context: {
  fromCurrency: SendCurrency
  targetRate: number
  direction: 'above' | 'below'
  token: string
}) {
  const condition = context.direction === 'above' ? 'rises above' : 'falls below'

  return {
    subject: 'Confirm your PakRemits rate alert',
    text: [
      `You asked us to tell you when ${context.fromCurrency} → PKR ${condition} ` +
        `${context.targetRate.toFixed(2)}.`,
      '',
      `Confirm it here: ${siteUrl()}/alerts/confirm/${context.token}`,
      '',
      'We will not send anything until you do. If this was not you, ignore this ' +
        'message and nothing further will arrive — the unconfirmed alert is ' +
        'deleted automatically.',
      '',
      `Remove this request now: ${siteUrl()}/alerts/unsubscribe/${context.token}`,
    ].join('\n'),
    html: renderAlertEmail({
      homeUrl: siteUrl(),
      preview: `Confirm your ${context.fromCurrency} to PKR rate alert`,
      label: 'One quick step',
      title: 'Confirm your rate alert',
      body: `You asked us to email you when ${context.fromCurrency} to PKR ${condition} ${context.targetRate.toFixed(2)}.`,
      action: { label: 'Confirm alert', url: `${siteUrl()}/alerts/confirm/${context.token}` },
      note: 'If you did not request this, ignore this email. We will not send any alerts unless you confirm.',
      unsubscribeUrl: `${siteUrl()}/alerts/unsubscribe/${context.token}`,
    }),
    headers: unsubscribeHeaders(`${siteUrl()}/alerts/unsubscribe/${context.token}`),
  }
}

/** Weekly digest for people who ticked the box. */
export function composeDigestMessage(context: {
  fromCurrency: SendCurrency
  currentRate: number
  weekChangePercent: number | null
  bestProviderName: string | null
  token: string
}) {
  const direction =
    context.weekChangePercent === null
      ? null
      : context.weekChangePercent >= 0
        ? `up ${context.weekChangePercent.toFixed(2)}% this week`
        : `down ${Math.abs(context.weekChangePercent).toFixed(2)}% this week`

  return {
    subject: `${context.fromCurrency} → PKR this week: ${context.currentRate.toFixed(2)}`,
    text: [
      `${context.fromCurrency} → PKR is ${context.currentRate.toFixed(2)}` +
        (direction ? `, ${direction}.` : '.'),
      ...(context.bestProviderName
        ? ['', `Paying the most right now: ${context.bestProviderName}.`]
        : []),
      '',
      `Full comparison: ${siteUrl()}/${context.fromCurrency.toLowerCase()}-to-pkr`,
      '',
      `Manage this alert: ${siteUrl()}/alerts/manage/${context.token}`,
      `Unsubscribe from this alert: ${siteUrl()}/alerts/unsubscribe/${context.token}`,
    ].join('\n'),
    html: renderAlertEmail({
      homeUrl: siteUrl(),
      preview: `${context.fromCurrency} to PKR is ${context.currentRate.toFixed(2)} this week`,
      label: 'Weekly rate update',
      title: `${context.fromCurrency} to PKR: ${context.currentRate.toFixed(2)}`,
      body: direction ? `The rate is ${direction}.` : 'See how this week’s rates compare.',
      facts: context.bestProviderName ? [{ label: 'Leading provider', value: context.bestProviderName }] : [],
      action: { label: 'Compare rates', url: `${siteUrl()}/${context.fromCurrency.toLowerCase()}-to-pkr` },
      manageUrl: `${siteUrl()}/alerts/manage/${context.token}`,
      unsubscribeUrl: `${siteUrl()}/alerts/unsubscribe/${context.token}`,
    }),
    headers: unsubscribeHeaders(`${siteUrl()}/alerts/unsubscribe/${context.token}`),
  }
}
