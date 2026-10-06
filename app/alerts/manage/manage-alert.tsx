'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CountryFlag } from '@/components/select-icons'
import { RATE_LIMIT_HOURS } from '@/lib/alerts/decide'
import { isPlausibleToken } from '@/lib/alerts/tokens'
import { CORRIDORS } from '@/lib/corridors'
import type { SendCurrency } from '@/lib/db/schema'
import { ratePath } from '@/lib/routes'

/** /api/alerts/manage/{token}: the alert, with the contact already masked. */
interface ManagedAlert {
  fromCurrency: SendCurrency
  targetRate: number
  direction: 'above' | 'below'
  channel: string
  contact: string
  confirmed: boolean
  active: boolean
  wantsDigest: boolean
  lastTriggeredAt: string | null
}

const WHEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; alert: ManagedAlert }

function post(token: string, body: Record<string, unknown>) {
  return fetch(`/api/alerts/manage/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * One alert's self-service page, from the link in every alert email
 * (/alerts/manage/{token}, which the Worker sends here with the token in the
 * query string). The token is the authorisation; there is no account.
 */
export function ManageAlert() {
  const query = useSearchParams()
  const router = useRouter()
  const token = query.get('token') ?? ''
  const justConfirmed = query.get('confirmed') === '1'
  const valid = isPlausibleToken(token)

  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [saving, setSaving] = useState<'digest' | 'delete' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!valid) return
    let current = true
    fetch(`/api/alerts/manage/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!current) return
        if (response.status === 404) return setLoad({ state: 'missing' })
        if (!response.ok) return setLoad({ state: 'error' })
        const { alert } = (await response.json()) as { alert: ManagedAlert }
        if (current) setLoad({ state: 'ready', alert })
      })
      .catch(() => current && setLoad({ state: 'error' }))
    return () => {
      current = false
    }
  }, [token, valid])

  if (!valid || load.state === 'missing') {
    return (
      <article className="max-w-[58ch]">
        <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">This alert link does not work</h1>
        <p className="mt-5 text-[17px] text-muted">
          The alert may have been removed already, or the link was cut short when it was copied.
          Unconfirmed alerts are deleted after 48 hours.
        </p>
        <Link href="/#alerts" className="mt-6 inline-block font-semibold text-leaf underline underline-offset-2">
          Set a new alert
        </Link>
      </article>
    )
  }

  if (load.state !== 'ready') {
    return (
      <article className="max-w-[640px]" aria-busy={load.state === 'loading'}>
        <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">Your rate alert</h1>
        {load.state === 'error' ? (
          <p className="mt-5 text-[17px] text-danger" role="alert">
            We could not load this alert just now. Try again in a minute.
          </p>
        ) : (
          <div className="skeleton mt-7 h-56 rounded-panel-lg" />
        )}
      </article>
    )
  }

  const { alert } = load
  const condition = alert.direction === 'above' ? 'Rises above' : 'Falls below'
  const countryCode =
    CORRIDORS.find((corridor) => corridor.fromCurrency === alert.fromCurrency)?.fromCountry ?? 'EU'

  // Same pill shapes as the result cards' badges.
  const status = !alert.confirmed
    ? { label: 'Waiting for you to confirm by email', className: 'bg-gold-bg text-gold-dark' }
    : alert.active
      ? { label: 'Active', className: 'bg-icon-bg text-ok' }
      : { label: 'Paused', className: 'bg-line-2 text-muted' }

  async function saveDigest(form: HTMLFormElement) {
    const wantsDigest = new FormData(form).get('wantsDigest') === 'on'
    setSaving('digest')
    setMessage(null)
    const response = await post(token, { wantsDigest }).catch(() => null)
    setSaving(null)
    if (response?.ok) {
      setLoad({ state: 'ready', alert: { ...alert, wantsDigest } })
      setMessage(wantsDigest ? 'Saved. The weekly summary is on.' : 'Saved. No weekly summary.')
    } else {
      setMessage('Could not save. Try again in a minute.')
    }
  }

  async function deleteAlert() {
    setSaving('delete')
    const response = await post(token, { delete: true }).catch(() => null)
    if (response?.ok) return router.push('/alerts/removed')
    setSaving(null)
    setMessage('Could not delete the alert. Try again in a minute.')
  }

  return (
    <article className="max-w-[640px]">
      {justConfirmed && (
        <p
          role="status"
          className="mb-7 flex items-center gap-3 rounded-panel bg-tint px-5 py-4 text-[15px] font-medium text-tint-ink"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          Confirmed. We will message you when the rate crosses your target.
        </p>
      )}

      <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">Your rate alert</h1>

      {/* The alert itself leads: the pair, then the target as the headline. */}
      <section className="mt-7 rounded-panel-lg bg-surface p-6 sm:p-8" aria-label="Alert details">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2.5 text-[15px] font-medium text-muted">
              <CountryFlag countryCode={countryCode} />
              {alert.fromCurrency} → PKR
            </p>
            <p className="mt-3 font-display text-[clamp(28px,4.5vw,36px)] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {condition} {alert.targetRate.toFixed(2)}
            </p>
          </div>
          <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${status.className}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {status.label}
          </span>
        </div>

        {/* The details, in the grey box the result cards use. */}
        <dl className="mt-7 grid rounded-[12px] bg-mist text-[15px] sm:grid-cols-2">
          <div className="border-b border-line p-4 sm:border-e sm:border-b-0">
            <dt className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">Sending to</dt>
            <dd className="mt-1.5 font-semibold">
              {/* Only the address may break; a long one must not push the box wider. */}
              <span className="break-all">{alert.contact}</span>
              <span className="ms-2 text-[13px] font-normal whitespace-nowrap text-muted">by {alert.channel}</span>
            </dd>
          </div>
          <div className="p-4">
            <dt className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">Last message</dt>
            <dd className="mt-1.5 font-semibold">
              {alert.lastTriggeredAt ? `${WHEN.format(new Date(alert.lastTriggeredAt))} PKT` : 'None yet'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-[13.5px] text-muted">
          At most one message every {RATE_LIMIT_HOURS} hours, however often the rate crosses.
        </p>
      </section>

      {/* Weekly summary */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void saveDigest(event.currentTarget)
        }}
        className="mt-4 rounded-panel-lg bg-surface p-6 sm:p-8"
      >
        <label className="flex cursor-pointer items-start gap-3.5">
          <input
            type="checkbox"
            name="wantsDigest"
            defaultChecked={alert.wantsDigest}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
          />
          <span className="text-[16px] font-medium">
            Send me a weekly summary of where {alert.fromCurrency} → PKR has been
            <span className="mt-1 block text-[14px] font-normal text-muted">
              One email a week, on its own schedule. It does not use up your alert.
            </span>
          </span>
        </label>
        <button
          type="submit"
          disabled={saving !== null}
          className="mt-5 h-11 cursor-pointer rounded-control border-[1.5px] border-line bg-surface px-6 text-[15px]
                     font-bold text-ink transition-[border-color,box-shadow] hover:border-accent
                     hover:shadow-[0_0_0_1.5px_var(--color-accent)] disabled:cursor-wait disabled:opacity-60"
        >
          {saving === 'digest' ? 'Saving…' : 'Save'}
        </button>
        {message && (
          <p role="status" className="mt-3 text-[14px] text-muted">
            {message}
          </p>
        )}
      </form>

      {/* Removal */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void deleteAlert()
        }}
        className="mt-4 rounded-panel-lg bg-surface p-6 sm:p-8"
      >
        <h2 className="text-[19px] font-semibold">Stop this alert</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          This deletes the alert and your contact details outright. We do not keep a record
          that you unsubscribed, because that would mean keeping your address.
        </p>
        <button
          type="submit"
          disabled={saving !== null}
          className="mt-5 h-11 cursor-pointer rounded-control border-[1.5px] border-danger/40 px-6 text-[15px]
                     font-bold text-danger transition-colors hover:border-danger hover:bg-danger-bg
                     disabled:cursor-wait disabled:opacity-60"
        >
          {saving === 'delete' ? 'Deleting…' : 'Delete this alert'}
        </button>
      </form>

      <Link
        href={ratePath(alert.fromCurrency)}
        className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold text-leaf no-underline hover:underline"
      >
        See where {alert.fromCurrency} → PKR is right now
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </article>
  )
}
