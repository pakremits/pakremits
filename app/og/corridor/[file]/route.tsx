/**
 * Per-corridor Open Graph image, at /og/corridor/{slug}.png.
 *
 * The whole point of a share card for this site is the number, so the card
 * carries the best rate rather than a generic logo. Drawn with next/og when
 * the site is built, after each refresh, so it moves with the rate. The
 * corridor and rate pages name this URL in their metadata.
 */
import '@/lib/db/static-build'
import { ImageResponse } from 'next/og'
import { refreshCadence } from '@/lib/cadence'
import { CORRIDORS, corridorBySlug } from '@/lib/corridors'
import { getComparison } from '@/lib/quotes'

/**
 * Satori's built-in font has no U+20A8 (₨), so formatPkr's symbol renders as a
 * tofu box on the card. "Rs" is unambiguous, universally covered, and is how
 * the amount is commonly written in Latin script anyway. Swap this for
 * formatPkr once a subsetted font with the glyph is embedded.
 */
function formatPkrForCard(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-GB')}`
}

const size = { width: 1200, height: 630 }

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return CORRIDORS.map((corridor) => ({ file: `${corridor.slug}.png` }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const corridor = corridorBySlug(file.replace(/.png$/, ''))

  // A failed read fails the build (see lib/quotes.ts) rather than drawing a
  // card without the rate.
  const comparison = corridor
    ? await getComparison({ corridorSlug: corridor.slug, method: 'bank' })
    : null

  const best = comparison?.rows.find((r) => r.isBest)
  // The ISO code, which for the Gulf three is now what CURRENCY_SYMBOLS holds
  // anyway. Taken from the corridor rather than the symbol map so no future
  // non-Latin glyph can reach satori, which renders those unjoined and in the
  // wrong order, exactly as it does the Urdu wordmark.
  const code = corridor ? corridor.fromCurrency : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#024E38',
          color: '#F3F6F4',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Latin only. Satori has no Arabic shaping or bidi without an embedded
            Nastaliq font, and renders "بھیجو" reversed and unjoined — a mangled
            brand name on a share card is worse than no Urdu on it. Add the
            wordmark back here only alongside a subsetted font file. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34 }}>
          <span style={{ fontWeight: 700 }}>PakRemits</span>
          <span style={{ color: '#E0A513', fontSize: 26 }}>
            Compare rates to Pakistan
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 30, color: '#B7E4D4' }}>
            {corridor ? `${corridor.fromCountryName} → Pakistan` : 'Send money to Pakistan'}
          </div>

          <div style={{ fontSize: 74, fontWeight: 600, lineHeight: 1.05, maxWidth: 900 }}>
            {best && comparison
              ? `${code} ${comparison.amount.toLocaleString('en-GB')} becomes ${formatPkrForCard(best.quote.amountReceived)}`
              : 'Compare rates before you send'}
          </div>

          {best && (
            // Satori requires an explicit display on any element with more than
            // one child, so this is built as a single string rather than
            // interpolated fragments.
            <div style={{ display: 'flex', fontSize: 30, color: '#7FE8C9' }}>
              {`Best right now: ${best.quote.providerName}${
                comparison?.savingVsBank
                  ? ` · ${formatPkrForCard(comparison.savingVsBank)} more than a bank`
                  : ''
              }`}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#9FD3C1',
            borderTop: '1px solid #0E644B',
            paddingTop: 22,
          }}
        >
          <span>Ranked by rupees received, not by who pays us</span>
          <span>{`Refreshed ${refreshCadence()}`}</span>
        </div>
      </div>
    ),
    size,
  )
}
