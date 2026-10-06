/**
 * Rate alerts: sign-up, the double opt-in link, self-service and unsubscribe.
 *
 * The emailed links keep their old URLs (/alerts/confirm|manage|unsubscribe/
 * {token}), so every email ever sent still works. They resolve here and hand
 * the reader to static pages: /alerts/manage and /alerts/unsubscribe/confirm,
 * which read the token from the query string and call /api/alerts/manage.
 *
 * The token is the authorisation — there is no account — so every route
 * checks it rather than trusting anything else in the request.
 */
import { and, eq } from 'drizzle-orm'
import { AlertInputSchema, normaliseContact } from '@/lib/alerts/validate'
import { composeConfirmMessage } from '@/lib/alerts/messages'
import { generateAlertToken, isPlausibleToken } from '@/lib/alerts/tokens'
import { verifyTurnstile } from '@/lib/alerts/turnstile'
import { db, toNum, toRate } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { countHit } from '@/lib/limits'
import { send } from '@/lib/notify'
import { clientIp } from '@/lib/rate-limit'
import { json, readFields, redirect } from './http'

/** Cap on confirmed alerts per contact, so one address cannot be used as a queue. */
const MAX_ALERTS_PER_CONTACT = 10

/** Sign-ups per IP per hour: plenty for a person, a brake on mail-bombing. */
const SIGNUPS_PER_HOUR = 5

/**
 * POST /api/alerts.
 *
 * Email sign-ups create an unconfirmed row and send a double opt-in link;
 * nothing is sent to that address until the link is used, and the row is
 * deleted after 48 hours if it never is.
 */
export async function handleSignup(request: Request): Promise<Response> {
  if (!(await countHit(`alerts:${clientIp(request)}`, SIGNUPS_PER_HOUR, 60 * 60 * 1000))) {
    return json({ error: 'Too many alerts set up from here in the last hour. Try again later.' }, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400)
  }

  const parsed = AlertInputSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return json({ error: issue?.message ?? 'Check the details and try again.', field: issue?.path?.[0] }, 400)
  }

  const input = parsed.data
  const expectedHostname = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).hostname
  if (!(await verifyTurnstile(input.turnstileToken, expectedHostname))) {
    return json({ error: 'Bot check failed or expired. Please try again.' }, 403)
  }
  // Phone delivery still needs verified opt-in and approved templates.
  if (process.env.NODE_ENV === 'production' && input.channel !== 'email') {
    return json({ error: 'Phone alerts are not available yet. Please use email.' }, 503)
  }
  const contact = normaliseContact(input.channel, input.contact)

  try {
    const existing = await db
      .select({
        id: rateAlerts.id,
        currency: rateAlerts.fromCurrency,
        target: rateAlerts.targetRate,
        direction: rateAlerts.direction,
        confirmed: rateAlerts.confirmed,
      })
      .from(rateAlerts)
      .where(and(eq(rateAlerts.userContact, contact), eq(rateAlerts.active, true)))

    // Silently succeed on an exact duplicate rather than creating a second
    // alert that would double-message them.
    const duplicate = existing.find(
      (row) =>
        row.currency === input.fromCurrency &&
        toNum(row.target) === toRate(input.targetRate) &&
        row.direction === input.direction,
    )
    if (duplicate) return json({ ok: true, alreadyExists: true })

    // One unconfirmed alert at a time per address. Otherwise anyone could send
    // a stranger a stack of confirmation emails, and the unconfirmed rows would
    // fill the cap and lock the real owner out for 48 hours.
    if (existing.some((row) => !row.confirmed)) {
      return json(
        {
          error:
            'We already sent a confirmation link to this address. Use it (check spam too), then add more alerts.',
        },
        429,
      )
    }

    // Only confirmed alerts count towards the cap.
    if (existing.filter((row) => row.confirmed).length >= MAX_ALERTS_PER_CONTACT) {
      return json({ error: `That is already ${MAX_ALERTS_PER_CONTACT} live alerts. Remove one first.` }, 429)
    }

    const token = generateAlertToken()
    // Phone channels are live immediately; email waits for the opt-in link.
    const confirmed = input.channel !== 'email'

    const [created] = await db
      .insert(rateAlerts)
      .values({
        userContact: contact,
        channel: input.channel,
        fromCurrency: input.fromCurrency,
        targetRate: toRate(input.targetRate),
        direction: input.direction,
        confirmed,
        confirmedAt: confirmed ? new Date() : null,
        active: true,
        wantsDigest: input.wantsDigest,
        unsubscribeToken: token,
      })
      .returning({ id: rateAlerts.id })

    if (input.channel === 'email') {
      const message = composeConfirmMessage({
        fromCurrency: input.fromCurrency,
        targetRate: input.targetRate,
        direction: input.direction,
        token,
      })

      const sent = await send({
        to: contact,
        channel: 'email',
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.headers,
      })

      if (!sent.ok) {
        console.error('[alerts] confirmation email failed:', sent.error)
        // Do not leave an unconfirmable duplicate behind. Duplicate detection
        // would otherwise make the next sign-up report success without sending
        // a fresh link.
        if (created) {
          await db
            .delete(rateAlerts)
            .where(eq(rateAlerts.id, created.id))
            .catch((error: unknown) => console.error('[alerts] failed sign-up cleanup failed:', error))
        }
        return json({ error: 'We could not send the confirmation email. Try again shortly.' }, 502)
      }
    }

    // Drives which confirmation copy the form shows.
    return json({ ok: true, needsConfirmation: input.channel === 'email' })
  } catch (error) {
    console.error('[alerts] sign-up failed:', error)
    return json({ error: 'Could not create the alert.' }, 500)
  }
}

/**
 * GET /alerts/confirm/{token}: the double opt-in link.
 *
 * A GET, because it is a link in an email and email clients only follow
 * links. So it is idempotent: clicking twice, or a mail scanner prefetching
 * it, is harmless.
 */
export async function handleConfirm(url: URL, token: string): Promise<Response> {
  if (!isPlausibleToken(token)) return redirect('/?alert=invalid', url)

  try {
    const [alert] = await db
      .select({ id: rateAlerts.id, confirmed: rateAlerts.confirmed })
      .from(rateAlerts)
      .where(eq(rateAlerts.unsubscribeToken, token))
      .limit(1)

    // Most likely an unconfirmed alert that aged out after 48 hours.
    if (!alert) return redirect('/?alert=expired', url)

    if (!alert.confirmed) {
      await db
        .update(rateAlerts)
        .set({ confirmed: true, confirmedAt: new Date(), active: true })
        .where(eq(rateAlerts.id, alert.id))
    }

    return redirect(`/alerts/manage?${new URLSearchParams({ token, confirmed: '1' })}`, url)
  } catch (error) {
    console.error('[alerts] confirm failed:', error)
    return redirect('/?alert=error', url)
  }
}

/** GET /alerts/manage/{token}: the "manage this alert" link, on to the static page. */
export function handleManageLink(url: URL, token: string): Response {
  if (!isPlausibleToken(token)) return redirect('/?alert=invalid', url)
  const query = new URLSearchParams({ token })
  if (url.searchParams.get('confirmed') === '1') query.set('confirmed', '1')
  return redirect(`/alerts/manage?${query}`, url)
}

/**
 * /alerts/unsubscribe/{token}.
 *
 * This deletes the row rather than flagging it inactive. The privacy policy
 * says contact details are deleted on unsubscribe and that we keep no
 * suppression list — holding an address in order to remember not to write to
 * it is still holding the address.
 *
 * A GET only opens the confirmation page, so mail scanners cannot delete an
 * alert by following a link. The page's button and RFC 8058 one-click
 * requests from mail clients POST. Deletion is idempotent.
 */
export async function handleUnsubscribe(request: Request, url: URL, token: string): Promise<Response> {
  if (request.method === 'GET') {
    return isPlausibleToken(token)
      ? redirect(`/alerts/unsubscribe/confirm?${new URLSearchParams({ token })}`, url)
      : redirect('/?alert=invalid', url)
  }

  const form = new URLSearchParams(await request.text())
  const isBrowserConfirmation = form.get('confirm') === '1'
  // RFC 8058 one-click lets Gmail and Outlook show their own unsubscribe
  // button, which cuts the spam complaints that would hurt sender reputation.
  const isInboxOneClick = form.get('List-Unsubscribe') === 'One-Click'
  if (!isBrowserConfirmation && !isInboxOneClick) return json({ ok: false }, 400)

  let outcome: 'done' | 'invalid' | 'error' = 'invalid'
  if (isPlausibleToken(token)) {
    try {
      await db.delete(rateAlerts).where(eq(rateAlerts.unsubscribeToken, token))
      outcome = 'done'
    } catch (error) {
      console.error('[alerts] unsubscribe failed:', error)
      outcome = 'error'
    }
  }

  if (isBrowserConfirmation) {
    return redirect(outcome === 'done' ? '/alerts/removed' : `/?alert=${outcome}`, url, 303)
  }
  return json({ ok: outcome === 'done' }, outcome === 'done' ? 200 : 400)
}

/** Mask the contact so a shared screenshot does not leak the whole address. */
export function maskContact(contact: string, channel: string): string {
  if (channel !== 'email') {
    return `${contact.slice(0, contact.length - 4).replace(/\d/g, '•')}${contact.slice(-4)}`
  }
  const [user, domain] = contact.split('@')
  if (!domain) return contact
  const head = user.slice(0, Math.min(2, user.length))
  return `${head}${'•'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

/**
 * /api/alerts/manage/{token}: what the static manage page shows and changes.
 * GET reads the alert, with the contact masked. POST either saves the weekly
 * summary choice (`{ wantsDigest }`) or deletes the alert (`{ delete: true }`).
 */
export async function handleManageApi(request: Request, token: string): Promise<Response> {
  if (!isPlausibleToken(token)) return json({ error: 'Not found' }, 404)

  if (request.method === 'GET') {
    const [alert] = await db
      .select()
      .from(rateAlerts)
      .where(eq(rateAlerts.unsubscribeToken, token))
      .limit(1)
    if (!alert) return json({ error: 'Not found' }, 404)

    return json({
      alert: {
        fromCurrency: alert.fromCurrency,
        targetRate: toNum(alert.targetRate),
        direction: alert.direction,
        channel: alert.channel,
        contact: maskContact(alert.userContact, alert.channel),
        confirmed: alert.confirmed,
        active: alert.active,
        wantsDigest: alert.wantsDigest,
        lastTriggeredAt: alert.lastTriggeredAt?.toISOString() ?? null,
      },
    })
  }

  const fields = await readFields(request)
  if (fields.delete === true) {
    await db.delete(rateAlerts).where(eq(rateAlerts.unsubscribeToken, token))
    return json({ ok: true, deleted: true })
  }
  if (typeof fields.wantsDigest === 'boolean') {
    await db
      .update(rateAlerts)
      .set({ wantsDigest: fields.wantsDigest })
      .where(eq(rateAlerts.unsubscribeToken, token))
    return json({ ok: true })
  }
  return json({ error: 'Nothing to change.' }, 400)
}
