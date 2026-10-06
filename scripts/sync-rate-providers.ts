/** Ensure providers collected by the scheduled job exist before it refreshes. */
import '../lib/load-env'
import { db, runBatch } from '../lib/db'
import { connectNodeD1 } from '../lib/db/node'
import { providers } from '../lib/db/schema'

const RATE_PROVIDERS = [
  {
    slug: 'enjaz-pay',
    name: 'Enjaz Pay',
    brandColor: '#FFFFFF',
    brandTextColor: '#786F6A',
    homepageUrl: 'https://www.bankalbilad.com.sa/en/personal/enjaz/pages/api-pakistan.aspx',
    affiliateNetwork: 'none' as const,
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
    supportsBank: true,
    supportsWallet: false,
    supportsNeobank: false,
    supportsCash: false,
    supportsRda: false,
  },
] as const

async function main() {
  const d1 = await connectNodeD1()
  await runBatch(
    RATE_PROVIDERS.map((provider) =>
      db
        .insert(providers)
        .values(provider)
        .onConflictDoUpdate({
          target: providers.slug,
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
  await d1.close()
  console.log(`Synced ${RATE_PROVIDERS.length} scheduled-rate providers (${d1.target} D1).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
