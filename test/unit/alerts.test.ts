/**
 * Alert logic tests.
 *
 * The trigger decision is where a bug either spams someone or silently never
 * fires, and neither shows up in a smoke test — so every branch is covered
 * here rather than left to the integration run.
 */
import { describe, expect, it } from 'vitest'
import { RATE_LIMIT_HOURS, decideTrigger, digestDue } from '@/lib/alerts/decide'
import { AlertInputSchema, normaliseContact } from '@/lib/alerts/validate'
import { generateAlertToken, isPlausibleToken } from '@/lib/alerts/tokens'
import { composeConfirmMessage, composeDigestMessage, composeTriggerMessage } from '@/lib/alerts/messages'

const NOW = new Date('2026-09-02T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

function alert(partial: Partial<Parameters<typeof decideTrigger>[0]> = {}) {
  return {
    direction: 'above' as const,
    targetRate: 380,
    active: true,
    confirmed: true,
    channel: 'email' as const,
    lastTriggeredAt: null,
    ...partial,
  }
}

describe('decideTrigger — direction', () => {
  it('fires when an "above" target is reached exactly', () => {
    expect(decideTrigger(alert(), 380, NOW)).toEqual({ fire: true })
  })

  it('fires when an "above" target is exceeded', () => {
    expect(decideTrigger(alert(), 381.5, NOW)).toEqual({ fire: true })
  })

  it('does not fire below an "above" target', () => {
    expect(decideTrigger(alert(), 379.99, NOW)).toEqual({
      fire: false,
      reason: 'threshold-not-crossed',
    })
  })

  it('fires when a "below" target is reached', () => {
    expect(decideTrigger(alert({ direction: 'below' }), 379, NOW)).toEqual({ fire: true })
  })

  it('does not fire above a "below" target', () => {
    expect(decideTrigger(alert({ direction: 'below' }), 381, NOW)).toEqual({
      fire: false,
      reason: 'threshold-not-crossed',
    })
  })
})

describe('decideTrigger — gating', () => {
  it('never fires an inactive alert', () => {
    expect(decideTrigger(alert({ active: false }), 400, NOW)).toEqual({
      fire: false,
      reason: 'inactive',
    })
  })

  it('never fires an unconfirmed email alert, however good the rate', () => {
    // Double opt-in is the whole point; a crossed threshold must not bypass it.
    expect(decideTrigger(alert({ confirmed: false }), 999, NOW)).toEqual({
      fire: false,
      reason: 'unconfirmed',
    })
  })

  it('fires an unconfirmed WhatsApp alert, which has no opt-in step', () => {
    expect(decideTrigger(alert({ confirmed: false, channel: 'whatsapp' }), 400, NOW)).toEqual({
      fire: true,
    })
  })

  it('does not fire when no rate is available rather than guessing', () => {
    expect(decideTrigger(alert(), null, NOW)).toEqual({
      fire: false,
      reason: 'no-rate-available',
    })
    expect(decideTrigger(alert(), 0, NOW).fire).toBe(false)
    expect(decideTrigger(alert(), Number.NaN, NOW).fire).toBe(false)
  })
})

describe('decideTrigger — rate limiting', () => {
  it(`suppresses a second message inside ${RATE_LIMIT_HOURS} hours`, () => {
    expect(decideTrigger(alert({ lastTriggeredAt: hoursAgo(1) }), 400, NOW)).toEqual({
      fire: false,
      reason: 'rate-limited',
    })
  })

  it('fires again once the window has passed', () => {
    expect(
      decideTrigger(alert({ lastTriggeredAt: hoursAgo(RATE_LIMIT_HOURS + 0.1) }), 400, NOW),
    ).toEqual({ fire: true })
  })

  it('treats the boundary as still limited', () => {
    expect(
      decideTrigger(alert({ lastTriggeredAt: hoursAgo(RATE_LIMIT_HOURS - 0.01) }), 400, NOW).fire,
    ).toBe(false)
  })

  it('reports the crossing reason before the rate limit', () => {
    // An alert that has not crossed is not "rate-limited" — the /admin counts
    // would be meaningless if a quiet market looked like throttling.
    expect(decideTrigger(alert({ lastTriggeredAt: hoursAgo(1) }), 100, NOW)).toEqual({
      fire: false,
      reason: 'threshold-not-crossed',
    })
  })
})

describe('digestDue', () => {
  const base = { active: true, confirmed: true, wantsDigest: true, lastDigestAt: null }

  it('is due immediately when never sent', () => {
    expect(digestDue(base, NOW)).toBe(true)
  })

  it('is not due six days after the last one', () => {
    expect(digestDue({ ...base, lastDigestAt: hoursAgo(24 * 6) }, NOW)).toBe(false)
  })

  it('is due after a week', () => {
    expect(digestDue({ ...base, lastDigestAt: hoursAgo(24 * 7 + 1) }, NOW)).toBe(true)
  })

  it('is never due without opt-in', () => {
    expect(digestDue({ ...base, wantsDigest: false }, NOW)).toBe(false)
  })

  it('is never due for an unconfirmed address', () => {
    expect(digestDue({ ...base, confirmed: false }, NOW)).toBe(false)
  })
})

describe('AlertInputSchema', () => {
  const valid = {
    channel: 'email' as const,
    contact: 'someone@example.com',
    fromCurrency: 'GBP' as const,
    targetRate: 380,
    direction: 'above' as const,
    wantsDigest: false,
    turnstileToken: 'test-token',
  }

  it('accepts a well-formed email alert', () => {
    expect(AlertInputSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a Turnstile token', () => {
    expect(AlertInputSchema.safeParse({ ...valid, turnstileToken: '' }).success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const result = AlertInputSchema.safeParse({ ...valid, contact: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('accepts real numbers from every corridor we serve', () => {
    const numbers = [
      '+447400123456', // UK
      '+971501234567', // UAE
      '+966501234567', // Saudi Arabia
      '+12025550123', // USA
      '+16135550123', // Canada
      '+61412345678', // Australia
      '+97433123456', // Qatar
      '+353851234567', // Ireland, standing in for the Eurozone
    ]
    for (const number of numbers) {
      const result = AlertInputSchema.safeParse({ ...valid, channel: 'whatsapp', contact: number })
      expect(result.success, `${number} should be valid`).toBe(true)
    }
  })

  it('rejects Ofcom\'s reserved drama range', () => {
    // +44 7700 900xxx is reserved for use in television and film, so it is a
    // safe placeholder but never a deliverable number. libphonenumber knows
    // this and a hand-rolled regex would not — which is the reason we use it.
    const result = AlertInputSchema.safeParse({
      ...valid,
      channel: 'whatsapp',
      contact: '+447700900123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a number with no country code', () => {
    // The exact case a permissive regex would wave through.
    const result = AlertInputSchema.safeParse({
      ...valid,
      channel: 'whatsapp',
      contact: '07700900123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects obviously wrong target rates', () => {
    expect(AlertInputSchema.safeParse({ ...valid, targetRate: 0 }).success).toBe(false)
    expect(AlertInputSchema.safeParse({ ...valid, targetRate: -5 }).success).toBe(false)
    expect(AlertInputSchema.safeParse({ ...valid, targetRate: 99_999 }).success).toBe(false)
  })
})

describe('normaliseContact', () => {
  it('lowercases emails so one address cannot be stored twice', () => {
    expect(normaliseContact('email', '  Someone@Example.COM ')).toBe('someone@example.com')
  })

  it('normalises phone numbers to E.164', () => {
    expect(normaliseContact('whatsapp', '+44 7400 123456')).toBe('+447400123456')
  })
})

describe('tokens', () => {
  it('generates tokens that pass the shape check', () => {
    for (let i = 0; i < 20; i++) {
      expect(isPlausibleToken(generateAlertToken())).toBe(true)
    }
  })

  it('generates distinct tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateAlertToken))
    expect(tokens.size).toBe(200)
  })

  it('rejects junk without a database round trip', () => {
    for (const junk of ['', 'short', '../../etc/passwd', 'a'.repeat(200), 'has spaces in it']) {
      expect(isPlausibleToken(junk)).toBe(false)
    }
  })
})

describe('message composition', () => {
  const context = {
    fromCurrency: 'GBP' as const,
    targetRate: 380,
    direction: 'above' as const,
    currentRate: 381.25,
    bestProviderName: 'Remitly',
    bestProviderSlug: 'remitly',
    amountSent: 500,
    currencySymbol: '£',
    amountReceived: 190_625,
    savingVsBank: 13_036,
    highestInDays: 31,
    token: 'x'.repeat(43),
  }

  it('states the crossing, the best provider and the landed amount', () => {
    const message = composeTriggerMessage(context, 'email')
    expect(message.text).toContain('GBP → PKR just crossed 380.00.')
    expect(message.text).toContain('Remitly at 381.25')
    expect(message.text).toContain('₨ 190,625')
  })

  it('quotes a rate the recipient could actually get', () => {
    // The message must never claim a crossing above the obtainable rate — that
    // was the inconsistency in the original design mock.
    const message = composeTriggerMessage(context, 'email')
    expect(context.currentRate).toBeGreaterThanOrEqual(context.targetRate)
    expect(message.text).toContain('381.25')
  })

  it('puts unsubscribe and manage links in every email', () => {
    const message = composeTriggerMessage(context, 'email')
    expect(message.text).toContain('/alerts/unsubscribe/')
    expect(message.text).toContain('/alerts/manage/')
    expect(message.html).toContain('Pak<span style="color:#e0a513">Remits</span>')
    expect(message.html).toContain('>Visit PakRemits</a>')
    expect(message.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(message.html).toContain('Unsubscribe from this alert</a>')
  })

  it('escapes provider names in HTML email', () => {
    const message = composeTriggerMessage({ ...context, bestProviderName: '<script>alert(1)</script>' }, 'email')
    expect(message.html).toContain('&lt;script&gt;')
    expect(message.html).not.toContain('<script>')
  })

  it('keeps WhatsApp to the facts and one link', () => {
    const message = composeTriggerMessage(context, 'whatsapp')
    expect(message.text.split('\n')).toHaveLength(1)
    expect(message.text).toContain('/go/remitly')
    expect(message.text.length).toBeLessThan(320)
  })

  it('says "dropped below" for a downward alert', () => {
    const message = composeTriggerMessage({ ...context, direction: 'below' }, 'email')
    expect(message.text).toContain('dropped below')
  })

  it('omits the "highest in N days" claim when the data does not support it', () => {
    const message = composeTriggerMessage({ ...context, highestInDays: null }, 'email')
    expect(message.text).not.toContain('highest rate in')
  })

  it('confirmation email leads with the confirm link and promises deletion', () => {
    const message = composeConfirmMessage({
      fromCurrency: 'GBP',
      targetRate: 380,
      direction: 'above',
      token: 'y'.repeat(43),
    })
    expect(message.text).toContain('/alerts/confirm/')
    expect(message.text).toContain('deleted automatically')
    expect(message.text).toContain('/alerts/unsubscribe/')
    expect(message.html).toContain('Pak<span style="color:#e0a513">Remits</span>')
    expect(message.html).toContain('Unsubscribe from this alert</a>')
    expect(message.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('gives the weekly digest the same visible unsubscribe button', () => {
    const message = composeDigestMessage({
      fromCurrency: 'GBP',
      currentRate: 381.25,
      weekChangePercent: 0.8,
      bestProviderName: 'Remitly',
      token: 'z'.repeat(43),
    })
    expect(message.text).toContain('/alerts/unsubscribe/')
    expect(message.html).toContain('Pak<span style="color:#e0a513">Remits</span>')
    expect(message.html).toContain('Unsubscribe from this alert</a>')
    expect(message.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})
