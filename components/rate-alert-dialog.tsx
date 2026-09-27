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

const labelClass =
  'mb-2 block text-[12px] font-semibold tracking-[0.04em] text-muted uppercase sm:mb-3 sm:text-[13px]'

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
    // On phones the dialog is a bottom sheet: let it slide down before it goes.
    const dialog = dialogRef.current
    const sheet =
      window.matchMedia('(max-width: 639.98px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (dialog && sheet && !('closing' in dialog.dataset)) {
      dialog.dataset.closing = ''
      dialog.addEventListener(
        'animationend',
        () => {
          delete dialog.dataset.closing
          finishClose()
        },
        { once: true },
      )
      return
    }
    finishClose()
  }

  function finishClose() {
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
      // `alert-sheet` turns it into a bottom sheet below sm; see globals.css.
      className="alert-sheet m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[560px] overflow-y-auto
                 rounded-[20px] bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgba(20,32,27,.35)]
                 backdrop:bg-[rgba(20,32,27,.45)]"
    >
      {open && (
        <div className="px-5 pt-3 pb-5 sm:p-8">
          {/* The sheet's grab handle. Decorative: close is the button, Escape, or the backdrop. */}
          <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start justify-between gap-4 sm:gap-6">
            <h2
              id="alert-dialog-title"
              className="text-[21px] leading-[1.2] font-bold tracking-[-0.02em] sm:text-[30px] sm:leading-[1.15]"
            >
              {t('dialogTitle')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('close')}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[10px] sm:h-10 sm:w-10
                         border-2 sm:border-[3px] border-line text-ink transition-[border-color,box-shadow]
                         hover:border-accent"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {status.kind === 'ok' ? (
            <div className="mt-5 rounded-[12px] border-s-4 border-accent bg-tint px-4 py-3.5 sm:mt-6 sm:px-5 sm:py-4" role="status">
              <h3 className="text-[16px] font-bold text-tint-ink sm:text-[18px]">
                {status.needsConfirmation ? t('checkInbox') : t('alertSet')}
              </h3>
              <p className="mt-1.5 text-[14px] text-ink sm:text-[15px]">
                {status.needsConfirmation ? t('checkInboxBody') : t('alertSetBody')}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[14.5px] leading-normal text-muted sm:text-[16.5px] sm:leading-relaxed">{t('dialogBody')}</p>

              <form onSubmit={onSubmit} className="mt-5 sm:mt-7">
                <label htmlFor="alert-pair" className={labelClass}>
                  {t('pair')}
                </label>
                <div className="h-12 rounded-[8px] border-2 border-line sm:h-[58px] sm:border-[3px]">
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
                    className="h-full w-full cursor-pointer gap-3 bg-transparent px-4 text-[17px] font-semibold sm:gap-4 sm:px-5 sm:text-[20px]
                               text-ink focus:outline-none focus-visible:outline-none"
                    variant="hero"
                    listMinWidth="min-w-[min(320px,100%)]"
                  />
                </div>

                <label htmlFor="alert-rate" className={`${labelClass} mt-4 sm:mt-6`}>
                  {t('targetRate')}
                </label>
                <div className="flex h-12 rounded-[8px] border-2 border-accent sm:h-[58px] sm:border-[3px]">
                  <input
                    id="alert-rate"
                    name="targetRate"
                    inputMode="decimal"
                    required
                    value={target}
                    onChange={(event) => setTarget(event.target.value.replace(/[^\d.]/g, ''))}
                    className="min-w-0 flex-1 bg-transparent px-4 text-[17px] font-semibold text-ink sm:px-5 sm:text-[20px]
                               tabular-nums focus:outline-none focus-visible:outline-none"
                  />
                  <span className="flex w-[60px] shrink-0 items-center justify-center border-s-2 border-line text-[15px] font-semibold text-muted sm:w-[70px] sm:border-s-[3px] sm:text-[17px]">
                    PKR
                  </span>
                </div>

                <label htmlFor="alert-contact" className={`${labelClass} mt-4 sm:mt-6`}>
                  {t('emailAddress')}
                </label>
                <input
                  id="alert-contact"
                  name="contact"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-[8px] border-2 border-line bg-surface px-4 sm:h-[58px] sm:border-[3px] sm:px-5
                             text-[17px] font-medium sm:text-[20px] text-ink placeholder:text-faint
                             focus:outline-none focus-visible:outline-none"
                />

                {/* What the alert will look like when it lands. */}
                <div
                  className="mt-4 rounded-[12px] border-s-4 border-accent bg-tint px-4 py-3 sm:mt-5 sm:px-5 sm:py-3.5"
                  aria-hidden="true"
                >
                  <div className="text-[12.5px] font-medium text-tint-ink sm:text-[14px]">{t('previewSender')}</div>
                  <p className="mt-1 text-[13.5px] leading-snug text-ink sm:text-[15px]">
                    {t.rich('previewLine', {
                      pair: `${currency} → PKR`,
                      rate: previewRate,
                      strong: (chunks) => <b className="font-semibold">{chunks}</b>,
                    })}
                  </p>
                </div>

                <label className="mt-4 flex cursor-pointer items-center gap-3 text-[14px] leading-snug text-ink sm:mt-5 sm:text-[15px]">
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
                  className="mt-4 h-[52px] w-full cursor-pointer rounded-[8px] bg-gold text-[17px] font-bold sm:h-[58px] sm:text-[20px]
                             text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed
                             disabled:opacity-60"
                >
                  {status.kind === 'sending' ? t('creating') : t('createAlert')}
                </button>

                <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-[12.5px] sm:mt-4 sm:text-[13px]">
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
