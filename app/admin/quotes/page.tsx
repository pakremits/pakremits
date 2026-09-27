import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { corridors, providers, rateQuotes } from '@/lib/db/schema'
import { AdminNav } from '@/components/admin-chrome'
import { getFormOptions } from './actions'
import { OverrideForm } from './override-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Quote overrides — PakRemits admin', robots: { index: false } }

/** Recent quotes across all providers, so a bad number is easy to spot. */
async function recentQuotes() {
  return db
    .select({
      id: rateQuotes.id,
      provider: providers.name,
      corridor: corridors.fromCountryName,
      currency: corridors.fromCurrency,
      method: rateQuotes.deliveryMethod,
      amountSent: rateQuotes.amountSent,
      rate: rateQuotes.rate,
      fee: rateQuotes.fee,
      amountReceived: rateQuotes.amountReceived,
      source: rateQuotes.source,
      stale: rateQuotes.stale,
      capturedAt: rateQuotes.capturedAt,
    })
    .from(rateQuotes)
    .innerJoin(providers, eq(rateQuotes.providerId, providers.id))
    .innerJoin(corridors, eq(rateQuotes.corridorId, corridors.id))
    .orderBy(desc(rateQuotes.capturedAt))
    .limit(60)
}

const PKT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function AdminQuotesPage() {
  const [options, quotes] = await Promise.all([getFormOptions(), recentQuotes()])

  return (
    <>
      <AdminNav current="/admin/quotes" />
      <main className="mx-auto max-w-[1200px] px-6 py-8">
      <h1 className="font-display text-3xl font-semibold">Quote overrides</h1>
      <p className="mt-2 max-w-[60ch] text-muted">
        Manual rows are written with source <code>manual</code> and rank exactly like live quotes.
        Use this to correct a bad scrape or enter a provider quote when automated collection is
        unavailable. Named account destinations use general bank-deposit quotes in the public comparison.
      </p>

      <OverrideForm providers={options.providers} corridors={options.corridors} />

      <h2 className="mt-12 font-display text-xl font-semibold">Last 60 quotes</h2>
      <div className="mt-4 overflow-x-auto rounded-panel border border-line bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-faint">
              <th className="p-3 font-medium">Captured (PKT)</th>
              <th className="p-3 font-medium">Provider</th>
              <th className="p-3 font-medium">Corridor</th>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 text-right font-medium">Sent</th>
              <th className="p-3 text-right font-medium">Rate</th>
              <th className="p-3 text-right font-medium">Fee</th>
              <th className="p-3 text-right font-medium">Received</th>
              <th className="p-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted">
                  No quotes yet. Run <code>npm run seed</code> then <code>npm run refresh</code>.
                </td>
              </tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-line-2 last:border-0">
                <td className="p-3 tabular-nums text-muted">{PKT.format(q.capturedAt)}</td>
                <td className="p-3">{q.provider}</td>
                <td className="p-3 text-muted">
                  {q.corridor} · {q.currency}
                </td>
                <td className="p-3 text-muted">{q.method}</td>
                <td className="p-3 text-right tabular-nums">{q.amountSent}</td>
                <td className="p-3 text-right tabular-nums">{Number(q.rate).toFixed(4)}</td>
                <td className="p-3 text-right tabular-nums">{q.fee}</td>
                <td className="p-3 text-right font-medium tabular-nums">
                  ₨ {Number(q.amountReceived).toLocaleString('en-PK')}
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
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
      </main>
    </>
  )
}
