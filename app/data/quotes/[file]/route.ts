/**
 * /data/quotes/{corridor}.json: everything the browser needs to rank one
 * corridor at any amount, payout and sort, written once per build.
 *
 * The interactive comparison panels and the /compare results page read these
 * (lib/quote-data.ts) instead of calling a server, and rank them with the
 * same code the build used for the page itself (lib/comparison.ts).
 */
import '@/lib/db/static-build'
import type { CorridorDataFile } from '@/lib/comparison'
import { CORRIDORS } from '@/lib/corridors'
import { getMidMarketSeries, loadQuoteSnapshot } from '@/lib/quotes'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return CORRIDORS.map((corridor) => ({ file: `${corridor.slug}.json` }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const snapshot = await loadQuoteSnapshot(file.replace(/\.json$/, ''))
  // Every listed corridor is active; a missing one is a broken database, and
  // the build should stop rather than publish an empty file.
  if (!snapshot) throw new Error(`No active corridor for ${file}`)

  const series = await getMidMarketSeries(snapshot.fromCurrency, 7)
  const body: CorridorDataFile = {
    ...snapshot,
    generatedAt: Date.now(),
    week: series.points.map((point) => ({ t: point.date.getTime(), rate: point.rate })),
  }
  return Response.json(body)
}
