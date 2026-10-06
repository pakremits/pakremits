/**
 * Seed: providers, corridors, and 90 days of mid-market history.
 *
 * Run with `npm run seed` (the local D1) or `D1_TARGET=remote npm run seed`.
 * The providers, corridors and benchmarks are idempotent — safe to re-run after
 * adding a provider. The history is not: re-running adds a second copy of it.
 *
 * The history is fetched live from Wise where possible so a fresh deploy shows
 * real sparklines immediately. If that fetch fails it falls back to a synthetic
 * random walk anchored to the current rate, clearly marked `source: 'synthetic'`
 * so it can be deleted once real history accumulates.
 */
import '../lib/load-env'
import { count, desc } from 'drizzle-orm'
import { getMidMarketHistory, getMidMarketRate } from '../lib/fx'
import { CORRIDORS, CURRENCY_SYMBOLS } from '../lib/corridors'
import { db, runBatch, toRate } from '../lib/db'
import { connectNodeD1 } from '../lib/db/node'
import { type SendCurrency, corridors, midMarketRates, providers } from '../lib/db/schema'
import { refreshBenchmarks } from '../lib/proof/benchmarks'

/**
 * Provider catalogue.
 *
 * `affiliateUrlTemplate` is null until each programme is approved — see the
 * README for which network handles which provider. A null template means the
 * redirect falls back to the homepage with no commission, which is the correct
 * behaviour before approval rather than a broken link.
 */
const PROVIDERS = [
  {
    slug: 'wise',
    name: 'Wise',
    brandColor: '#163300',
    brandTextColor: '#9FE870',
    homepageUrl: 'https://wise.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: 'Fixed bounty per new customer via Impact. Does not affect ranking.',
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'remitly',
    name: 'Remitly',
    brandColor: '#2E3192',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.remitly.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: 'Fixed bounty per first transfer via Impact. Does not affect ranking.',
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'enjaz-pay',
    name: 'Enjaz Pay',
    brandColor: '#FFFFFF',
    brandTextColor: '#786F6A',
    homepageUrl: 'https://www.bankalbilad.com.sa/en/personal/enjaz/pages/api-pakistan.aspx',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'telemoney',
    name: 'TeleMoney',
    brandColor: '#FF304B',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://anb.com.sa/en/web/anb/telemoney',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'taptap-send',
    name: 'Taptap Send',
    brandColor: '#9AD9B4',
    brandTextColor: '#086A3B',
    homepageUrl: 'https://www.taptapsend.com/en/send-money-to/pakistan',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'xoom',
    name: 'Xoom',
    brandColor: '#1473E6',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.xoom.com/pakistan/send-money',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'worldremit',
    name: 'WorldRemit',
    brandColor: '#5A2D82',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.worldremit.com',
    affiliateNetwork: 'impact' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'careem',
    name: 'Careem Pay',
    brandColor: '#D7F8E5',
    brandTextColor: '#005C4B',
    homepageUrl: 'https://www.careem.com/en-AE/pay/send-money-aed-to-pkr-rate',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'botim',
    name: 'BOTIM',
    brandColor: '#FFFFFF',
    brandTextColor: '#2046F5',
    homepageUrl: 'https://botim.me/international-transfer/',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'ace',
    name: 'ACE Money Transfer',
    brandColor: '#9C1F3C',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://acemoneytransfer.com',
    affiliateNetwork: 'direct' as const,
    commissionNote: 'Direct partnership. Does not affect ranking.',
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'moneygram',
    name: 'MoneyGram',
    brandColor: '#E61915',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.moneygram.com',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'western-union',
    name: 'Western Union',
    brandColor: '#142832',
    brandTextColor: '#FFD500',
    homepageUrl: 'https://www.westernunion.com',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: true,
    supportsNeobank: false,
    supportsCash: true,
    supportsRda: false,
  },
  {
    slug: 'al-ansari',
    name: 'Al Ansari Exchange',
    brandColor: '#075CE5',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://alansariexchange.com/send-money-to-pakistan-from-the-uae/',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'sadapay',
    name: 'Sadapay',
    brandColor: '#6C2BD9',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://sadapay.pk',
    affiliateNetwork: 'none' as const,
    // Sadapay is a receiving wallet, not a sending service — quotes are entered
    // manually via /admin/quotes rather than fetched by an adapter.
    commissionNote: null,
    supportsBank: false,
    supportsWallet: false,
    supportsNeobank: true,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'nayapay',
    name: 'Nayapay',
    brandColor: '#00B9AE',
    brandTextColor: '#FFFFFF',
    homepageUrl: 'https://www.nayapay.com',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: false,
    supportsWallet: false,
    supportsNeobank: true,
    supportsCash: false,
    supportsRda: false,
  },
  {
    slug: 'typical-bank',
    name: 'Bank Transfer',
    brandColor: '#8A8F8C',
    brandTextColor: '#FFFFFF',
    homepageUrl: '',
    affiliateNetwork: 'none' as const,
    commissionNote: null,
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
    isBenchmark: true,
  },
]

async function seedProviders() {
  await runBatch(
    PROVIDERS.map((provider) =>
      db
        .insert(providers)
        .values(provider)
        .onConflictDoUpdate({
          target: providers.slug,
          // Deliberately does not overwrite affiliateUrlTemplate or featured —
          // those are set in production and must survive a reseed.
          set: {
            name: provider.name,
            brandColor: provider.brandColor,
            brandTextColor: provider.brandTextColor,
            homepageUrl: provider.homepageUrl,
            supportsBank: provider.supportsBank,
            supportsWallet: provider.supportsWallet,
            supportsNeobank: provider.supportsNeobank,
            supportsCash: provider.supportsCash,
            supportsRda: provider.supportsRda,
          },
        }),
    ),
  )
  console.log(`✓ ${PROVIDERS.length} providers`)
}

async function seedCorridors() {
  await runBatch(
    CORRIDORS.map((corridor) =>
      db
        .insert(corridors)
        .values({
          slug: corridor.slug,
          fromCurrency: corridor.fromCurrency,
          fromCountry: corridor.fromCountry,
          fromCountryName: corridor.fromCountryName,
          toCurrency: 'PKR',
          currencySymbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
        })
        .onConflictDoUpdate({
          target: corridors.slug,
          set: {
            fromCountryName: corridor.fromCountryName,
            currencySymbol: CURRENCY_SYMBOLS[corridor.fromCurrency],
          },
        }),
    ),
  )
  console.log(`✓ ${CORRIDORS.length} corridors`)
}

/**
 * A deterministic random walk, used only when Wise history is unavailable.
 * Seeded off the currency code so repeat runs produce the same shape rather
 * than a new fake history each time.
 */
function syntheticHistory(anchorRate: number, days: number, seedText: string) {
  let seed = [...seedText].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const next = () => {
    // Mulberry32 — small, deterministic, good enough for a decorative chart.
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const points: { date: Date; rate: number }[] = []
  let rate = anchorRate * 0.97 // start slightly below and drift up to today

  for (let i = days; i > 0; i--) {
    rate *= 1 + (next() - 0.45) * 0.004
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - i)
    date.setUTCHours(12, 0, 0, 0)
    points.push({ date, rate: Number(rate.toFixed(6)) })
  }
  return points
}

/** Rows per history insert: 5 columns each, under D1's 100 bound parameters. */
const HISTORY_ROWS_PER_INSERT = 20

/**
 * 90 days, so the charts' 3M range has history from the first day. Skipped
 * when the table already has rows: a second copy would double every point.
 */
async function seedMidMarketHistory(days = 90) {
  const [existing] = await db.select({ n: count() }).from(midMarketRates)
  if ((existing?.n ?? 0) > 0) {
    console.log(`✓ mid-market history: ${existing.n} rows already, left alone`)
    return
  }

  let real = 0
  let synthetic = 0

  for (const corridor of CORRIDORS) {
    let points: { date: Date; rate: number }[]
    let source: string

    try {
      points = await getMidMarketHistory(corridor.fromCurrency, days)
      source = 'wise'
      real += 1
    } catch (error) {
      const current = await getMidMarketRate(corridor.fromCurrency).catch(() => null)
      if (!current) {
        console.warn(`  ! ${corridor.fromCurrency}: no rate available, skipping history`)
        continue
      }
      points = syntheticHistory(current.rate, days, corridor.fromCurrency)
      source = 'synthetic'
      synthetic += 1
      console.warn(
        `  ! ${corridor.fromCurrency}: Wise history unavailable ` +
          `(${error instanceof Error ? error.message : error}); wrote synthetic history`,
      )
    }

    if (points.length === 0) continue

    const rows = points.map((p) => ({
      fromCurrency: corridor.fromCurrency,
      toCurrency: 'PKR',
      rate: toRate(p.rate),
      capturedAt: p.date,
      source,
    }))
    const inserts = []
    for (let start = 0; start < rows.length; start += HISTORY_ROWS_PER_INSERT) {
      inserts.push(db.insert(midMarketRates).values(rows.slice(start, start + HISTORY_ROWS_PER_INSERT)))
    }
    await runBatch(inserts)
  }

  console.log(`✓ mid-market history: ${real} real, ${synthetic} synthetic`)
}

/**
 * Seed the bank benchmarks from the latest mid-market rate.
 *
 * Without these the comparison table has no benchmark row and the savings
 * ledger records every click with a null saving, so a fresh install would count
 * nothing. The cron regenerates them weekly; this just means the site works on
 * the first run rather than after the first Sunday.
 */
async function seedBankBenchmarks() {
  const rows = await db
    .select({ currency: midMarketRates.fromCurrency, rate: midMarketRates.rate })
    .from(midMarketRates)
    .orderBy(desc(midMarketRates.capturedAt))

  // Newest row wins; the query is already in descending capture order.
  const latest = new Map<SendCurrency, number>()
  for (const row of rows) {
    if (!latest.has(row.currency)) latest.set(row.currency, Number(row.rate))
  }

  const { written } = await refreshBenchmarks(latest)
  console.log(`✓ bank benchmarks: ${written} written`)
}

async function main() {
  const d1 = await connectNodeD1()
  console.log(`Seeding PakRemits (${d1.target} D1)…`)
  await seedProviders()
  await seedCorridors()
  await seedMidMarketHistory()
  await seedBankBenchmarks()
  await d1.close()
  console.log('Done. Run `npm run refresh` to pull the first live quotes.')
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
