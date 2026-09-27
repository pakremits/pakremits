import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
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

  const condition = alert.direction === 'above' ? 'rises above' : 'falls below'

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-[1120px] px-6 py-14">
        <article className="max-w-[62ch]">
          {justConfirmed === '1' && (
            <p className="mb-6 rounded-panel border border-leaf bg-[#dcf5ec] p-4 text-[15px] text-[#037252]">
              Confirmed. We will message you when the rate crosses your target.
            </p>
          )}

          <h1 className="text-[clamp(30px,4vw,42px)] leading-[1.06] font-semibold">
            Your rate alert
          </h1>

          <div className="mt-7 rounded-panel border border-line bg-white p-6">
            <dl className="grid gap-4 text-[16px] sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted">Watching</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {alert.fromCurrency} → PKR {condition} {toNum(alert.targetRate).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Sending to</dt>
                <dd className="mt-1 font-medium">
                  {maskContact(alert.userContact, alert.channel)}
                  <span className="ml-2 text-[13px] text-muted">({alert.channel})</span>
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Status</dt>
                <dd className="mt-1 font-medium">
                  {!alert.confirmed
                    ? 'Waiting for you to confirm by email'
                    : alert.active
                      ? 'Active'
                      : 'Paused'}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Last message</dt>
                <dd className="mt-1 font-medium">
                  {alert.lastTriggeredAt ? `${WHEN.format(alert.lastTriggeredAt)} PKT` : 'None yet'}
                </dd>
              </div>
            </dl>

            <p className="mt-5 border-t border-line-2 pt-4 text-[13.5px] text-muted">
              At most one message every {RATE_LIMIT_HOURS} hours, however often the rate crosses.
            </p>
          </div>

          {/* Digest toggle */}
          <form action={setDigest} className="mt-6 rounded-panel border border-line bg-white p-6">
            <input type="hidden" name="token" value={token} />
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="wantsDigest"
                defaultChecked={alert.wantsDigest}
                className="mt-1 h-4 w-4 accent-[#037252]"
              />
              <span className="text-[15.5px]">
                Send me a weekly summary of where {alert.fromCurrency} → PKR has been
                <span className="mt-1 block text-[13.5px] text-muted">
                  One email a week, on its own schedule. It does not use up your alert.
                </span>
              </span>
            </label>
            <button
              type="submit"
              className="mt-4 h-10 rounded-control border-[1.5px] border-line px-5 text-[14px]
                         font-medium hover:border-ink hover:bg-ink hover:text-white"
            >
              Save
            </button>
          </form>

          {/* Removal */}
          <form action={deleteAlert} className="mt-6 rounded-panel border border-line bg-white p-6">
            <input type="hidden" name="token" value={token} />
            <h2 className="text-[19px] font-semibold">Stop this alert</h2>
            <p className="mt-2 text-[15px] text-muted">
              This deletes the alert and your contact details outright. We do not keep a record
              that you unsubscribed, because that would mean keeping your address.
            </p>
            <button
              type="submit"
              className="mt-4 h-10 rounded-control border-[1.5px] border-[#E0B4B4] px-5
                         text-[14px] font-medium text-[#A32D2D] hover:bg-[#A32D2D] hover:text-white"
            >
              Delete this alert
            </button>
          </form>

          <p className="mt-8 text-[15px] text-muted">
            <Link
              href={ratePath(alert.fromCurrency)}
              className="text-leaf underline underline-offset-2"
            >
              See where {alert.fromCurrency} → PKR is right now
            </Link>
          </p>
        </article>
      </main>

      <SiteFooter />
    </>
  )
}
