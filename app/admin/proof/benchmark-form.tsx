'use client'

import { useActionState } from 'react'
import { type BenchmarkFormState, unpinBenchmark, updateBenchmark } from './actions'
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_BASE } from '@/components/admin-chrome'

interface Row {
  corridorId: number
  countryName: string
  currency: string
  deliveryMethod: string
  rate: number
  fee: number
  note: string | null
  pinned: boolean
  updatedAt: Date
}

const FIELD = `${FIELD_BASE} h-10 px-2.5 text-[13.5px]`

/**
 * Edit one benchmark row.
 *
 * Saving pins the row, which is destructive in a quiet way — it stops the
 * weekly refresh touching it — so the button says so rather than just "Save".
 */
export function BenchmarkForm({ row }: { row: Row }) {
  const [state, formAction, pending] = useActionState<BenchmarkFormState, FormData>(
    updateBenchmark,
    null,
  )
  const [unpinState, unpinAction, unpinPending] = useActionState<BenchmarkFormState, FormData>(
    unpinBenchmark,
    null,
  )

  return (
    <tr className="border-t border-line-2 align-top first:border-0">
      <td className="py-3 pe-3 font-medium text-ink">
        {row.countryName}
        <span className="block text-[12px] text-muted">{row.deliveryMethod}</span>
      </td>

      <td className="py-3 pe-3" colSpan={4}>
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="corridorId" value={row.corridorId} />
          <input type="hidden" name="deliveryMethod" value={row.deliveryMethod} />

          <label className="block w-28 text-[12px] text-muted">
            Rate
            <input
              name="rate"
              type="number"
              step="0.000001"
              defaultValue={row.rate}
              className={FIELD}
              required
            />
          </label>

          <label className="block w-24 text-[12px] text-muted">
            Fee ({row.currency})
            <input
              name="fee"
              type="number"
              step="0.01"
              defaultValue={row.fee}
              className={FIELD}
              required
            />
          </label>

          <label className="block min-w-[200px] flex-1 text-[12px] text-muted">
            Note — shown on the public methodology page
            <input
              name="note"
              type="text"
              defaultValue={row.note ?? ''}
              placeholder="e.g. HBL counter quote, 12 Sep"
              className={FIELD}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON_PRIMARY} h-10 px-4 text-[13.5px]`}
          >
            {pending ? 'Saving…' : 'Save and pin'}
          </button>

          {row.pinned && (
            <button
              type="submit"
              formAction={unpinAction}
              disabled={unpinPending}
              className={`${BUTTON_SECONDARY} h-10 px-4 text-[13.5px] disabled:opacity-60`}
            >
              {unpinPending ? 'Unpinning…' : 'Unpin'}
            </button>
          )}

          {(state ?? unpinState) && (
            <p
              className={`w-full text-[12.5px] ${
                (state ?? unpinState)?.ok ? 'text-ok' : 'text-danger'
              }`}
            >
              {(state ?? unpinState)?.message}
            </p>
          )}
        </form>

        <p className="mt-1 text-[12px] text-muted">
          {row.pinned ? 'Pinned — the weekly refresh skips this row.' : 'Generated weekly.'}{' '}
          Updated {row.updatedAt.toISOString().slice(0, 10)}.
        </p>
      </td>
    </tr>
  )
}
