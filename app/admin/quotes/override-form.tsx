'use client'

import { useActionState } from 'react'
import { DELIVERY_METHODS } from '@/lib/db/schema'
import { type OverrideState, saveManualQuote } from './actions'
import { BUTTON_PRIMARY, FIELD_BASE } from '@/components/admin-chrome'

interface Props {
  providers: { id: number; name: string }[]
  corridors: { id: number; name: string; currency: string }[]
}

const FIELD = `${FIELD_BASE} h-11 px-3`

export function OverrideForm({ providers, corridors }: Props) {
  const [state, formAction, pending] = useActionState<OverrideState, FormData>(
    saveManualQuote,
    null,
  )

  return (
    <form action={formAction} className="rounded-panel-lg bg-surface p-6 shadow-[0_10px_30px_-18px_rgba(0,0,0,.28)]">
      <h2 className="mb-4 font-display text-[17px] font-semibold text-ink">Add a manual quote</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Provider</span>
          <select name="providerId" required className={FIELD} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Corridor</span>
          <select name="corridorId" required className={FIELD} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {corridors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.currency}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Delivery method</span>
          <select name="deliveryMethod" required className={FIELD} defaultValue="bank">
            {DELIVERY_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Amount sent</span>
          <input name="amountSent" type="number" step="0.01" required className={FIELD} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Rate (per 1 unit)</span>
          <input name="rate" type="number" step="0.000001" required className={FIELD} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Fee</span>
          <input name="fee" type="number" step="0.01" defaultValue="0" required className={FIELD} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Speed text</span>
          <input
            name="deliverySpeedText"
            required
            placeholder="Same day"
            className={FIELD}
            maxLength={60}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Speed (minutes)</span>
          <input name="deliverySpeedMinutes" type="number" placeholder="480" className={FIELD} />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-muted">Promo note (optional)</span>
          <input
            name="promoNote"
            placeholder="New-customer rate"
            className={FIELD}
            maxLength={120}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON_PRIMARY} h-11 px-6 text-[15px]`}
        >
          {pending ? 'Saving…' : 'Save override'}
        </button>

        {/* aria-live so the result is announced, not just shown. */}
        <p
          aria-live="polite"
          className={`text-sm font-medium ${state?.ok === false ? 'text-danger' : 'text-ok'}`}
        >
          {state?.message}
        </p>
      </div>

      <p className="mt-4 text-xs text-faint">
        Received is computed as (amount − fee) × rate, the same way live quotes are, so a manual
        row is directly comparable rather than computed a second way.
      </p>
    </form>
  )
}
