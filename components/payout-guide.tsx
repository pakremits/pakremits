import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { type Locale, localePath } from '@/i18n/routing'
import { PayoutMethodIcon, type PayoutOption } from '@/components/select-icons'
import { methodPath } from '@/lib/routes'

/**
 * "How will they receive it?" — one row per way the money can land.
 *
 * Rails with their own guide page link there; the rest open the comparison
 * already set to that payout, from the same corridor and amount as the hero.
 */
export async function PayoutGuide({
  locale,
  corridor,
  amount,
}: {
  locale: Locale
  corridor: string
  amount: number
}) {
  const t = await getTranslations({ locale, namespace: 'home' })
  const tMethods = await getTranslations({ locale, namespace: 'methods' })

  const compare = (payout: PayoutOption) =>
    `${localePath(locale, '/compare')}?${new URLSearchParams({ from: corridor, to: payout, amount: String(amount) })}`

  const rows: { key: string; icon: PayoutOption; name: string; body: string; href: string }[] = [
    { key: 'bank', icon: 'bank', name: tMethods('bank'), body: t('payoutBank'), href: compare('bank') },
    { key: 'jazzcash', icon: 'jazzcash', name: 'JazzCash', body: t('payoutJazzcash'), href: methodPath('jazzcash', locale) },
    { key: 'easypaisa', icon: 'easypaisa', name: 'Easypaisa', body: t('payoutEasypaisa'), href: methodPath('easypaisa', locale) },
    { key: 'neobank', icon: 'sadapay', name: tMethods('neobank'), body: t('payoutNeobank'), href: compare('sadapay') },
    { key: 'cash', icon: 'cash', name: tMethods('cash'), body: t('payoutCash'), href: compare('cash') },
    { key: 'rda', icon: 'rda', name: tMethods('rda'), body: t('payoutRda'), href: methodPath('rda', locale) },
  ]

  return (
    <section id="receive" aria-labelledby="receive-title" className="mt-24">
      <div className="max-w-[54ch]">
        <h2 id="receive-title" className="text-[clamp(30px,4vw,36px)] leading-[1.1] font-semibold">
          {t('payoutTitle')}
        </h2>
        <p className="mt-3 text-[17px] text-muted">{t('payoutLede')}</p>
      </div>

      <div className="card-rise mt-7 overflow-hidden rounded-panel bg-surface">
        <ul className="grid lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="group flex h-full items-center gap-4 px-5 py-5 text-ink no-underline
                           transition-colors hover:bg-tint sm:px-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-icon-bg">
                  <PayoutMethodIcon method={row.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{row.name}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-muted">{row.body}</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0 text-faint transition-colors group-hover:text-leaf rtl:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
