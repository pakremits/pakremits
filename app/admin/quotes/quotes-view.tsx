'use client'

import { ADMIN_MAIN, AdminHeader, Empty, Panel, TABLE, TD, TH, THEAD_ROW, TR } from '@/components/admin-chrome'
import { useAdminData } from '@/lib/admin/client'
import type { DeliveryMethod, QuoteSource, SendCurrency } from '@/lib/db/schema'
import { OverrideForm } from './override-form'

/** /admin/api/quotes, as JSON: dates arrive as strings. */
interface QuotesData {
  options: {
    providers: { id: number; name: string }[]
    corridors: { id: number; name: string; currency: SendCurrency }[]
  }
  quotes: {
    id: number
    provider: string
    corridor: string
    currency: SendCurrency
    method: DeliveryMethod
    amountSent: number
    rate: number
    fee: number
    amountReceived: number
    source: QuoteSource
    stale: boolean
    capturedAt: string
  }[]
}

const TITLE = 'Quote overrides'
const LEDE =
  'Manual rows are written with source manual and rank exactly like live quotes. Use this to correct a bad scrape or enter a provider quote when automated collection is unavailable. Named account destinations use general bank-deposit quotes in the public comparison.'

const PKT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Manual quotes and the latest captures. Loads in the browser. */
export function QuotesView() {
  const { data, error } = useAdminData<QuotesData>('quotes')

  if (!data) {
    return (
      <>
        <AdminHeader current="/admin/quotes" title={TITLE} lede={LEDE} />
        <main className={ADMIN_MAIN}>
          <Panel title={error ? 'Could not load the quotes' : 'Loading…'}>
            {error ? <Empty>{error}</Empty> : <div className="skeleton h-40 rounded-[12px]" />}
          </Panel>
        </main>
      </>
    )
  }

  const options = data.options
  const quotes = data.quotes.map((quote) => ({ ...quote, capturedAt: new Date(quote.capturedAt) }))

  return (
    <>
      <AdminHeader
        current="/admin/quotes"
        title={TITLE}
        lede={LEDE}
      />
      <main className={ADMIN_MAIN}>
      <OverrideForm providers={options.providers} corridors={options.corridors} />

      <Panel title="Last 60 quotes" hint="Newest first, across every provider and corridor." className="mt-5">
      <div className="overflow-x-auto">
        <table className={`${TABLE} min-w-[900px]`}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Captured (PKT)</th>
              <th className={TH}>Provider</th>
              <th className={TH}>Corridor</th>
              <th className={TH}>Method</th>
              <th className={`${TH} text-right`}>Sent</th>
              <th className={`${TH} text-right`}>Rate</th>
              <th className={`${TH} text-right`}>Fee</th>
              <th className={`${TH} text-right`}>Received</th>
              <th className={TH}>Source</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td colSpan={9} className="rounded-[12px] bg-mist p-6 text-center text-muted">
                  No quotes yet. Run <code>npm run seed</code> then <code>npm run refresh</code>.
                </td>
              </tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className={TR}>
                <td className={`${TD} tabular-nums text-muted`}>{PKT.format(q.capturedAt)}</td>
                <td className={`${TD} font-medium text-ink`}>{q.provider}</td>
                <td className={`${TD} text-muted`}>
                  {q.corridor} · {q.currency}
                </td>
                <td className={`${TD} text-muted`}>{q.method}</td>
                <td className={`${TD} text-right tabular-nums`}>{q.amountSent}</td>
                <td className={`${TD} text-right tabular-nums`}>{Number(q.rate).toFixed(4)}</td>
                <td className={`${TD} text-right tabular-nums`}>{q.fee}</td>
                <td className={`${TD} text-right font-medium tabular-nums`}>
                  ₨ {Number(q.amountReceived).toLocaleString('en-PK')}
                </td>
                <td className={`${TD}`}>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      q.stale
                        ? 'bg-gold-bg text-gold-dark'
                        : q.source === 'manual'
                          ? 'bg-promo-bg text-promo'
                          : 'bg-icon-bg text-ok'
                    }`}
                  >
                    {q.stale ? 'stale' : q.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Panel>
      </main>
    </>
  )
}
