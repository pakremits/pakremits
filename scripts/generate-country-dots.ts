/**
 * Builds lib/hero/country-dots.ts: a dot grid for each sending country and for
 * Pakistan, drawn as dotted silhouettes in the corridor pages' banner.
 *
 *   npx tsx scripts/generate-country-dots.ts
 *
 * Source: Natural Earth 1:50m admin-0 countries (public domain), fetched at run
 * time so nothing large is committed; the output is a few KB of bit grids.
 * Boundaries are Natural Earth's default (de facto) ones.
 *
 * Each grid has square cells on the ground: a longitude step of latStep /
 * cos(mid-latitude), so high-latitude countries are not stretched sideways.
 */
import { writeFileSync } from 'node:fs'

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

/** Cells along the longer side of every grid. */
const CELLS = 110

type Ring = [number, number][]
type Polygon = Ring[]

interface Region {
  /** ADM0_A3 codes whose land makes up the silhouette. */
  countries: string[]
  /** [west, south, east, north]: keeps outlying territories out of the shape. */
  clip: [number, number, number, number]
}

/** Keyed by corridor slug, plus Pakistan. */
const REGIONS: Record<string, Region> = {
  pakistan: { countries: ['PAK'], clip: [60, 23, 78, 38] },
  uk: { countries: ['GBR'], clip: [-8.8, 49.8, 2, 61] },
  uae: { countries: ['ARE'], clip: [51, 22.5, 56.5, 26.2] },
  'saudi-arabia': { countries: ['SAU'], clip: [34, 16, 56, 33] },
  qatar: { countries: ['QAT'], clip: [50.6, 24.4, 51.8, 26.3] },
  // The lower 48: Alaska and Hawaii would shrink the familiar shape to nothing.
  usa: { countries: ['USA'], clip: [-125, 24.4, -66.8, 49.5] },
  canada: { countries: ['CAN'], clip: [-141, 41.6, -52.5, 72] },
  australia: { countries: ['AUS'], clip: [112.5, -44, 154, -10] },
  // The 21 euro-area members as of 2026 (Bulgaria joined in January), mainland
  // Europe and the Mediterranean islands only.
  eurozone: {
    countries: [
      'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'IRL',
      'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'PRT', 'SVK', 'SVN', 'ESP',
    ],
    clip: [-10.5, 34.5, 34.7, 70.2],
  },
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Even-odd over every ring, so holes (lakes, enclaves) stay empty. */
function onLand(x: number, y: number, polygons: Polygon[]): boolean {
  return polygons.some((polygon) => polygon.reduce((acc, ring) => (inRing(x, y, ring) ? !acc : acc), false))
}

async function main() {
  const geo = (await (await fetch(SOURCE)).json()) as {
    features: { properties: { ADM0_A3: string }; geometry: { type: string; coordinates: unknown } }[]
  }

  const out: Record<string, { bbox: number[]; cols: number; rows: number; bits: string }> = {}

  for (const [key, region] of Object.entries(REGIONS)) {
    const polygons: Polygon[] = []
    for (const feature of geo.features) {
      if (!region.countries.includes(feature.properties.ADM0_A3)) continue
      const { type, coordinates } = feature.geometry
      if (type === 'Polygon') polygons.push(coordinates as Polygon)
      else if (type === 'MultiPolygon') polygons.push(...(coordinates as Polygon[]))
    }
    if (!polygons.length) throw new Error(`No geometry for ${key}`)

    // Tighten the clip box to the land actually inside it.
    const [cw, cs, ce, cn] = region.clip
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const polygon of polygons)
      for (const [x, y] of polygon[0])
        if (x >= cw && x <= ce && y >= cs && y <= cn) {
          w = Math.min(w, x)
          e = Math.max(e, x)
          s = Math.min(s, y)
          n = Math.max(n, y)
        }

    const squash = Math.cos((((s + n) / 2) * Math.PI) / 180)
    const groundW = (e - w) * squash
    const groundH = n - s
    const step = Math.max(groundW, groundH) / CELLS
    const cols = Math.max(1, Math.round(groundW / step))
    const rows = Math.max(1, Math.round(groundH / step))

    const bytes = new Uint8Array(Math.ceil((cols * rows) / 8))
    let count = 0
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = w + ((c + 0.5) / cols) * (e - w)
        const y = n - ((r + 0.5) / rows) * (n - s)
        if (onLand(x, y, polygons)) {
          const i = r * cols + c
          bytes[i >> 3] |= 1 << (7 - (i & 7))
          count++
        }
      }

    const round = (v: number) => Math.round(v * 1000) / 1000
    out[key] = { bbox: [w, s, e, n].map(round), cols, rows, bits: Buffer.from(bytes).toString('base64') }
    console.log(`${key}: ${cols}×${rows}, ${count} dots`)
  }

  const body = Object.entries(out)
    .map(([key, grid]) => `  ${JSON.stringify(key)}: ${JSON.stringify(grid)},`)
    .join('\n')

  writeFileSync(
    'lib/hero/country-dots.ts',
    `/**
 * Dot grids for the corridor banners' country silhouettes. Generated by
 * scripts/generate-country-dots.ts from Natural Earth 1:50m countries; do not
 * edit by hand.
 *
 * Each grid covers \`bbox\` ([west, south, east, north], degrees) in \`cols\` ×
 * \`rows\` square-on-the-ground cells, row-major from the north-west corner;
 * \`bits\` is base64, one bit per cell, most significant bit first.
 */

export interface CountryDots {
  bbox: [number, number, number, number]
  cols: number
  rows: number
  bits: string
}

export const COUNTRY_DOTS: Record<string, CountryDots> = {
${body}
}
`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
