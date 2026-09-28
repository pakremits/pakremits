import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { CountryFlag } from '@/components/select-icons'
import { CORRIDORS } from '@/lib/corridors'
import { db, toNum } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { isPlausibleToken } from '@/lib/alerts/tokens'
import { RATE_LIMIT_HOURS } from '@/lib/alerts/decide'
import { ratePath } from '@/lib/routes'
import { deleteAlert, setDigest } from './actions'

export const dynamic = 'force-dynamic'

/** Never indexed: the URL is a capability token. */
export const metadata: Metadata = {
  title: 'Your rate alert — PakRemits',
  robots: { index: false, follow: false },
}

const WHEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Mask the contact so a shared screenshot does not leak the whole address. */
function maskContact(contact: string, channel: string): string {
  if (channel !== 'email') {
    return `${contact.slice(0, contact.length - 4).replace(/\d/g, '•')}${contact.slice(-4)}`
  }
  const [user, domain] = contact.split('@')
  if (!domain) return contact
  const head = user.slice(0, Math.min(2, user.length))
  return `${head}${'•'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

export default async function ManageAlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ confirmed?: string }>
}) {
  const { token } = await params
  const { confirmed: justConfirmed } = await searchParams

  if (!isPlausibleToken(token)) notFound()

  const [alert] = await db
    .select()
    .from(rateAlerts)
    .where(eq(rateAlerts.unsubscribeToken, token))
    .limit(1)

  if (!alert) notFound()

  const condition = alert.direction === 'above' ? 'Rises above' : 'Falls below'
  const countryCode =
    CORRIDORS.find((corridor) => corridor.fromCurrency === alert.fromCurrency)?.fromCountry ?? 'EU'

  // Same pill shapes as the result cards' badges.
  const status = !alert.confirmed
    ? { label: 'Waiting for you to confirm by email', className: 'bg-gold-bg text-gold-dark' }
    : alert.active
      ? { label: 'Active', className: 'bg-icon-bg text-ok' }
      : { label: 'Paused', className: 'bg-line-2 text-muted' }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-[1120px] px-6 py-12 sm:py-14">
        <article className="max-w-[640px]">
          {justConfirmed === '1' && (
            <p
              role="status"
              className="mb-7 flex items-center gap-3 rounded-panel bg-tint px-5 py-4 text-[15px] font-medium text-tint-ink"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              Confirmed. We will message you when the rate crosses your target.
            </p>
          )}

          <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">Your rate alert</h1>

          {/* The alert itself leads: the pair, then the target as the headline. */}
          <section className="mt-7 rounded-panel-lg bg-surface p-6 sm:p-8" aria-label="Alert details">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2.5 text-[15px] font-medium text-muted">
                  <CountryFlag countryCode={countryCode} />
                  {alert.fromCurrency} → PKR
                </p>
                <p className="mt-3 font-display text-[clamp(28px,4.5vw,36px)] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                  {condition} {toNum(alert.targetRate).toFixed(2)}
                </p>
              </div>
              <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${status.className}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {status.label}
              </span>
            </div>

            {/* The details, in the grey box the result cards use. */}
            <dl className="mt-7 grid rounded-[12px] bg-mist text-[15px] sm:grid-cols-2">
              <div className="border-b border-line p-4 sm:border-e sm:border-b-0">
                <dt className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">Sending to</dt>
                <dd className="mt-1.5 font-semibold">
                  {/* Only the address may break; a long one must not push the box wider. */}
                  <span className="break-all">{maskContact(alert.userContact, alert.channel)}</span>
                  <span className="ms-2 text-[13px] font-normal whitespace-nowrap text-muted">by {alert.channel}</span>
                </dd>
              </div>
              <div className="p-4">
                <dt className="text-[12px] font-medium tracking-[0.06em] text-muted uppercase">Last message</dt>
                <dd className="mt-1.5 font-semibold">
                  {alert.lastTriggeredAt ? `${WHEN.format(alert.lastTriggeredAt)} PKT` : 'None yet'}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-[13.5px] text-muted">
              At most one message every {RATE_LIMIT_HOURS} hours, however often the rate crosses.
            </p>
          </section>

          {/* Weekly summary */}
          <form action={setDigest} className="mt-4 rounded-panel-lg bg-surface p-6 sm:p-8">
            <input type="hidden" name="token" value={token} />
            <label className="flex cursor-pointer items-start gap-3.5">
              <input
                type="checkbox"
                name="wantsDigest"
                defaultChecked={alert.wantsDigest}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
              />
              <span className="text-[16px] font-medium">
                Send me a weekly summary of where {alert.fromCurrency} → PKR has been
                <span className="mt-1 block text-[14px] font-normal text-muted">
                  One email a week, on its own schedule. It does not use up your alert.
                </span>
              </span>
            </label>
            <button
              type="submit"
              className="mt-5 h-11 cursor-pointer rounded-control border-[1.5px] border-line bg-surface px-6 text-[15px]
                         font-bold text-ink transition-[border-color,box-shadow] hover:border-accent
                         hover:shadow-[0_0_0_1.5px_var(--color-accent)]"
            >
              Save
            </button>
          </form>

          {/* Removal */}
          <form action={deleteAlert} className="mt-4 rounded-panel-lg bg-surface p-6 sm:p-8">
            <input type="hidden" name="token" value={token} />
            <h2 className="text-[19px] font-semibold">Stop this alert</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              This deletes the alert and your contact details outright. We do not keep a record
              that you unsubscribed, because that would mean keeping your address.
            </p>
            <button
              type="submit"
              className="mt-5 h-11 cursor-pointer rounded-control border-[1.5px] border-danger/40 px-6 text-[15px]
                         font-bold text-danger transition-colors hover:border-danger hover:bg-danger-bg"
            >
              Delete this alert
            </button>
          </form>

          <Link
            href={ratePath(alert.fromCurrency)}
            className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold text-leaf no-underline hover:underline"
          >
            See where {alert.fromCurrency} → PKR is right now
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </article>
      </main>

      <SiteFooter />
    </>
  )
}
