'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { IconSelect, type IconSelectOption } from '@/components/icon-select'
import { CountryFlag } from '@/components/select-icons'
import { TurnstileWidget } from '@/components/turnstile-widget'

/**
 * The rate alert dialog.
 *
 * Mounted once in the locale layout. Every "Rate alerts" / "Set a rate alert"
 * link on the site points at `/#alerts`; this intercepts those clicks and opens
 * here instead, so the header, footer and compare page need no client code of
 * their own. A page loaded with #alerts (an old link, a bookmark) opens it too.
 *
 * The submission is unchanged from the old inline form: same fields, same
 * `/api/alerts` contract, same Turnstile check.
 */

export interface AlertPairOption {
  currency: string
  countryCode: string
  /** Latest mid-market rate, shown beside the pair and used for the default target. */
  rate: number | null
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok'; needsConfirmation: boolean }
  | { kind: 'error'; message: string }

/** The next round figure above the current rate — what someone setting a target usually wants. */
function suggestedTarget(rate: number | null): string {
  return rate ? (Math.ceil(rate / 5) * 5).toFixed(2) : ''
}

function isAlertsLink(anchor: HTMLAnchorElement): boolean {
  const url = new URL(anchor.href, window.location.href)
  return url.origin === window.location.origin && url.hash === '#alerts'
}

const labelClass = 'mb-3 block text-[13px] font-semibold tracking-[0.04em] text-muted uppercase'

export function RateAlertDialog({
  pairs,
  turnstileSiteKey,
}: {
  pairs: AlertPairOption[]
  turnstileSiteKey: string
}) {
  const t = useTranslations('alerts')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  const first = pairs[0]
  const [currency, setCurrency] = useState(first?.currency ?? 'GBP')
  const [target, setTarget] = useState(() => suggestedTarget(first?.rate ?? null))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [resetNonce, setResetNonce] = useState(0)

  // Open from any #alerts link, and from a page that loads on #alerts.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return
      }
      const anchor = (event.target as Element).closest?.('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || !isAlertsLink(anchor)) return
      event.preventDefault()
      setOpen(true)
    }

    // Capture phase, so Next's Link never starts a navigation to /#alerts.
    document.addEventListener('click', onClick, true)
    if (window.location.hash === '#alerts') {
      // Defer so the opening is not a synchronous state change in the effect.
      queueMicrotask(() => setOpen(true))
    }
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function close() {
    setOpen(false)
    if (window.location.hash === '#alerts') {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      )
    }
    // A finished alert starts fresh next time; a half-typed one is kept.
    if (status.kind === 'ok') setStatus({ kind: 'idle' })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!turnstileToken) return
    const form = new FormData(event.currentTarget)
    setStatus({ kind: 'sending' })

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          contact: form.get('contact'),
          fromCurrency: currency,
          targetRate: target,
          // Every alert is a "rises above" alert. The API still requires the
          // field and the delivery pipeline branches on it, so it is pinned.
          direction: 'above',
          wantsDigest: form.get('wantsDigest') === 'on',
          turnstileToken,
        }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        needsConfirmation?: boolean
      }

      if (!response.ok || !payload.ok) {
        setTurnstileToken(null)
        setResetNonce((value) => value + 1)
        setStatus({ kind: 'error', message: payload.error ?? t('genericError') })
        return
      }

      setStatus({ kind: 'ok', needsConfirmation: Boolean(payload.needsConfirmation) })
    } catch {
      setTurnstileToken(null)
      setResetNonce((value) => value + 1)
      setStatus({ kind: 'error', message: t('genericError') })
    }
  }

  const pairOptions: IconSelectOption[] = pairs.map((pair) => ({
    value: pair.currency,
    label: `${pair.currency} → PKR`,
    hint: pair.rate?.toFixed(2),
    icon: <CountryFlag countryCode={pair.countryCode} />,
  }))

  const targetNumber = Number.parseFloat(target)
  const previewRate = Number.isFinite(targetNumber)
    ? Number.isInteger(targetNumber)
      ? String(targetNumber)
      : targetNumber.toFixed(2)
    : '—'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="alert-dialog-title"
      // Escape fires `cancel`; route it through close() so state stays in step.
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[560px] overflow-y-auto
                 rounded-[20px] bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgba(20,32,27,.35)]
                 backdrop:bg-[rgba(20,32,27,.45)]"
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-6">
            <h2
              id="alert-dialog-title"
              className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-[30px]"
            >
              {t('dialogTitle')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('close')}
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[10px]
                         border-[3px] border-line text-ink transition-[border-color,box-shadow]
                         hover:border-accent"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {status.kind === 'ok' ? (
            <div className="mt-6 rounded-[12px] border-s-4 border-accent bg-tint px-5 py-4" role="status">
              <h3 className="text-[18px] font-bold text-tint-ink">
                {status.needsConfirmation ? t('checkInbox') : t('alertSet')}
              </h3>
              <p className="mt-1.5 text-[15px] text-ink">
                {status.needsConfirmation ? t('checkInboxBody') : t('alertSetBody')}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[16.5px] leading-relaxed text-muted">{t('dialogBody')}</p>

              <form onSubmit={onSubmit} className="mt-7">
                <label htmlFor="alert-pair" className={labelClass}>
                  {t('pair')}
                </label>
                <div className="h-[58px] rounded-[8px] border-[3px] border-line">
                  <IconSelect
                    id="alert-pair"
                    label={t('pair')}
                    value={currency}
                    options={pairOptions}
                    onChange={(next) => {
                      setCurrency(next)
                      // Re-seed the target from the new pair: 370 means nothing to AED.
                      setTarget(suggestedTarget(pairs.find((pair) => pair.currency === next)?.rate ?? null))
                    }}
                    className="h-full w-full cursor-pointer gap-4 bg-transparent px-5 text-[20px] font-semibold
                               text-ink focus:outline-none focus-visible:outline-none"
                    variant="hero"
                    listMinWidth="min-w-[min(320px,100%)]"
                  />
                </div>

                <label htmlFor="alert-rate" className={`${labelClass} mt-6`}>
                  {t('targetRate')}
                </label>
                <div className="flex h-[58px] rounded-[8px] border-[3px] border-accent">
                  <input
                    id="alert-rate"
                    name="targetRate"
                    inputMode="decimal"
                    required
                    value={target}
                    onChange={(event) => setTarget(event.target.value.replace(/[^\d.]/g, ''))}
                    className="min-w-0 flex-1 bg-transparent px-5 text-[20px] font-semibold text-ink
                               tabular-nums focus:outline-none focus-visible:outline-none"
                  />
                  <span className="flex w-[70px] shrink-0 items-center justify-center border-s-[3px] border-line text-[17px] font-semibold text-muted">
                    PKR
                  </span>
                </div>

                <label htmlFor="alert-contact" className={`${labelClass} mt-6`}>
                  {t('emailAddress')}
                </label>
                <input
                  id="alert-contact"
                  name="contact"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-[58px] w-full rounded-[8px] border-[3px] border-line bg-surface px-5
                             text-[20px] font-medium text-ink placeholder:text-faint
                             focus:outline-none focus-visible:outline-none"
                />

                {/* What the alert will look like when it lands. */}
                <div
                  className="mt-5 rounded-[12px] border-s-4 border-accent bg-tint px-5 py-3.5"
                  aria-hidden="true"
                >
                  <div className="text-[14px] font-medium text-tint-ink">{t('previewSender')}</div>
                  <p className="mt-1 text-[15px] leading-snug text-ink">
                    {t.rich('previewLine', {
                      pair: `${currency} → PKR`,
                      rate: previewRate,
                      strong: (chunks) => <b className="font-semibold">{chunks}</b>,
                    })}
                  </p>
                </div>

                <label className="mt-5 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
                  <input
                    type="checkbox"
                    name="wantsDigest"
                    className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
                  />
                  {t('digestOptIn')}
                </label>

                {turnstileSiteKey ? (
                  <div className="mt-4">
                    <TurnstileWidget
                      siteKey={turnstileSiteKey}
                      onToken={setTurnstileToken}
                      resetNonce={resetNonce}
                      theme="light"
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-danger">{t('unavailable')}</p>
                )}

                <button
                  type="submit"
                  disabled={status.kind === 'sending' || !turnstileToken}
                  className="mt-4 h-[58px] w-full cursor-pointer rounded-[8px] bg-gold text-[20px] font-bold
                             text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed
                             disabled:opacity-60"
                >
                  {status.kind === 'sending' ? t('creating') : t('createAlert')}
                </button>

                <p aria-live="polite" className="mt-4 min-h-[1.25rem] text-center text-[13px]">
                  {status.kind === 'error' ? (
                    <span className="text-danger">{status.message}</span>
                  ) : (
                    <span className="text-muted">{t('fineprint')}</span>
                  )}
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </dialog>
  )
}
