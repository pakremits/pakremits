import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { affiliateClicks, comparisonEvents, rateAlerts, savingsLedger } from '@/lib/db/schema'
import { __resetRateLimits } from '@/lib/rate-limit'
import { applyQuoteChanges } from '@/lib/quotes-write'
import worker from '@/worker/index'
import { type TestD1, addCorridor, addProvider, startD1 } from './d1'

const SITE = 'https://stage.pakremits.com'
const PASSWORD = 'test-admin-password'
const TOKEN = 'a'.repeat(43)

let d1: TestD1
beforeAll(async () => {
  d1 = await startD1()
})
afterAll(() => d1.dispose())
beforeEach(async () => {
  await d1.reset()
  __resetRateLimits()
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('ADMIN_PASSWORD', PASSWORD)
  vi.stubEnv('ROBOTS_ALLOW_INDEXING', 'false')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Call the Worker as Cloudflare would, and wait for its after-response work. */
async function request(path: string, init: RequestInit & { ip?: string } = {}) {
  const pending: Promise<unknown>[] = []
  const headers = new Headers(init.headers)
  headers.set('cf-connecting-ip', init.ip ?? '203.0.113.7')
  const response = await worker.fetch(
    new Request(`${SITE}${path}`, { ...init, headers }),
    {
      DB: d1.binding,
      ASSETS: { fetch: async (assetRequest: Request) => new Response(`asset ${new URL(assetRequest.url).pathname}`) },
    },
    { waitUntil: (promise) => pending.push(promise) },
  )
  await Promise.all(pending)
  return response
}

const basic = (password: string) => ({ authorization: `Basic ${btoa(`admin:${password}`)}` })

describe('the Worker', () => {
  it('reports health and the deployed commit, with the site headers', async () => {
    vi.stubEnv('GIT_SHA', '4c8ed3c0a1b2c3d4e5f60718293a4b5c6d7e8f90')
    const response = await request('/api/health')
    expect(await response.json()).toEqual({
      ok: true,
      service: 'pakremits',
      commit: '4c8ed3c0a1b2c3d4e5f60718293a4b5c6d7e8f90',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('passes static pages under its prefixes through to the assets', async () => {
    expect(await (await request('/alerts/removed')).text()).toBe('asset /alerts/removed')
    expect(await (await request('/alerts/unsubscribe/confirm')).text()).toBe('asset /alerts/unsubscribe/confirm')
    expect((await request('/api/nope')).status).toBe(404)
  })
})

describe('/go', () => {
  it('redirects at once and logs the click and its saving afterwards', async () => {
    const corridorId = await addCorridor('uk', 'GBP', 'GB')
    const providerId = await addProvider('wise', { affiliateUrlTemplate: 'https://wise.example/?subid={clickId}' })
    await applyQuoteChanges([
      {
        kind: 'fresh',
        quote: {
          providerId,
          corridorId,
          deliveryMethod: 'bank',
          amountSent: 2000,
          rate: 370,
          fee: 4,
          amountReceived: 738_520,
          deliverySpeedText: 'Same day',
          deliverySpeedMinutes: null,
          promoFlag: false,
          promoNote: null,
          source: 'api',
          capturedAt: new Date(),
        },
      },
    ])
    await d1.binding
      .prepare('INSERT INTO bank_benchmarks (corridor_id, delivery_method, rate, fee) VALUES (?, ?, ?, ?)')
      .bind(corridorId, 'bank', 355, 15)
      .run()

    const response = await request('/go/wise?corridor=uk&amount=999999&method=bank&utm_source=news')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toMatch(/^https:\/\/wise\.example\/\?subid=[0-9a-f-]{36}$/)
    expect(response.headers.get('referrer-policy')).toBe('origin')

    const [click] = await db.select().from(affiliateClicks)
    expect(click).toMatchObject({ providerId, corridorId, utm: 'utm_source=news', amountSent: 999_999 })
    // The saving is worked out on the largest standard amount, not 999,999.
    const [saving] = await db.select().from(savingsLedger)
    expect(saving.amountSent).toBe(2000)
  })

  it('never links the benchmark out, and sends unknown providers to the list', async () => {
    await addProvider('typical-bank', { isBenchmark: true })
    expect((await request('/go/typical-bank')).headers.get('location')).toBe(`${SITE}/how-we-rank#bank-benchmark`)
    expect((await request('/go/nope')).headers.get('location')).toBe(`${SITE}/providers`)
  })
})

describe('alerts', () => {
  async function signUp(contact = 'someone@example.com') {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ success: true, hostname: 'stage.pakremits.com' })),
    )
    return request('/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'email',
        contact,
        fromCurrency: 'GBP',
        targetRate: 380,
        direction: 'above',
        turnstileToken: 'token',
      }),
    })
  }

  it('signs up, confirms by link, lets the token manage the alert and unsubscribes', async () => {
    expect(await (await signUp()).json()).toEqual({ ok: true, needsConfirmation: true })
    const [alert] = await db.select().from(rateAlerts)
    expect(alert.confirmed).toBe(false)
    const token = alert.unsubscribeToken

    const confirm = await request(`/alerts/confirm/${token}`)
    expect(confirm.headers.get('location')).toBe(`${SITE}/alerts/manage?token=${token}&confirmed=1`)
    expect(confirm.headers.get('referrer-policy')).toBe('no-referrer')

    const manage = await (await request(`/api/alerts/manage/${token}`)).json()
    expect(manage.alert).toMatchObject({ confirmed: true, contact: 'so•••••@example.com', wantsDigest: false })

    await request(`/api/alerts/manage/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wantsDigest: true }),
    })
    expect((await db.select().from(rateAlerts))[0].wantsDigest).toBe(true)

    // A link-following scanner cannot unsubscribe: the GET only asks.
    const ask = await request(`/alerts/unsubscribe/${token}`)
    expect(ask.headers.get('location')).toBe(`${SITE}/alerts/unsubscribe/confirm?token=${token}`)
    expect(await db.select().from(rateAlerts)).toHaveLength(1)

    const done = await request(`/alerts/unsubscribe/${token}`, { method: 'POST', body: 'confirm=1' })
    expect(done.status).toBe(303)
    expect(done.headers.get('location')).toBe(`${SITE}/alerts/removed`)
    expect(await db.select().from(rateAlerts)).toHaveLength(0)
  })

  it('accepts an inbox one-click unsubscribe but not an arbitrary POST', async () => {
    await signUp()
    const [{ unsubscribeToken: token }] = await db.select().from(rateAlerts)

    expect((await request(`/alerts/unsubscribe/${token}`, { method: 'POST', body: 'unrelated=1' })).status).toBe(400)
    const oneClick = await request(`/alerts/unsubscribe/${token}`, {
      method: 'POST',
      body: 'List-Unsubscribe=One-Click',
    })
    expect(await oneClick.json()).toEqual({ ok: true })
  })

  it('sends a bad or expired link home with a reason', async () => {
    expect((await request('/alerts/confirm/bad')).headers.get('location')).toBe(`${SITE}/?alert=invalid`)
    expect((await request(`/alerts/confirm/${TOKEN}`)).headers.get('location')).toBe(`${SITE}/?alert=expired`)
    expect((await request(`/api/alerts/manage/${TOKEN}`)).status).toBe(404)
  })

  it('allows one unconfirmed alert per address, and five sign-ups an hour per IP', async () => {
    await signUp()
    const second = await request('/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'email',
        contact: 'someone@example.com',
        fromCurrency: 'AED',
        targetRate: 76,
        direction: 'above',
        turnstileToken: 'token',
      }),
    })
    expect(second.status).toBe(429)

    for (let i = 0; i < 3; i++) await signUp(`other${i}@example.com`)
    // Five counted from this IP so far; the sixth is refused before anything else.
    expect((await signUp('sixth@example.com')).status).toBe(429)
  })
})

describe('the comparison beacon', () => {
  it('issues a session first and counts only with one, once a minute', async () => {
    await addCorridor('uk', 'GBP', 'GB')
    const body = JSON.stringify({ corridor: 'uk' })
    const headers = { 'content-type': 'application/json' }

    const first = await request('/api/events', { method: 'POST', body, headers })
    expect(first.status).toBe(204)
    const cookie = first.headers.get('set-cookie')!
    expect(cookie).toMatch(/^prq_sid=[0-9a-f-]{36}; Path=\/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure$/)
    expect(await db.select().from(comparisonEvents)).toHaveLength(0)

    const session = { ...headers, cookie: cookie.split(';')[0] }
    await request('/api/events', { method: 'POST', body, headers: session })
    await request('/api/events', { method: 'POST', body, headers: session })
    expect(await db.select().from(comparisonEvents)).toHaveLength(1)

    expect((await request('/api/events', { method: 'POST', body: '{"corridor":"mars"}', headers })).status).toBe(400)
  })
})

describe('admin', () => {
  it('requires the password for pages and data alike', async () => {
    const page = await request('/admin')
    expect(page.status).toBe(401)
    expect(page.headers.get('www-authenticate')).toContain('Basic')
    expect((await request('/admin/api/dashboard')).status).toBe(401)

    const allowed = await request('/admin/proof', { headers: basic(PASSWORD) })
    expect(await allowed.text()).toBe('asset /admin/proof')
    expect(allowed.headers.get('cache-control')).toBe('no-store')

    const data = await (await request('/admin/api/dashboard', { headers: basic(PASSWORD) })).json()
    expect(data).toHaveProperty('totals')
    expect(data.refreshIntervalMinutes).toBe(1440)
  })

  it('locks an IP out after ten wrong passwords, even for the right one', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request('/admin', { headers: basic('wrong') })).status).toBe(401)
    }
    expect((await request('/admin', { headers: basic(PASSWORD) })).status).toBe(429)
    // Another address is unaffected.
    expect((await request('/admin', { headers: basic(PASSWORD), ip: '198.51.100.1' })).status).toBe(200)
  })

  it('runs the forms and reports what went wrong', async () => {
    const providerId = await addProvider('wise')
    const form = new FormData()
    form.set('providerId', String(providerId))
    const featured = await request('/admin/api/providers/featured', {
      method: 'POST',
      body: form,
      headers: basic(PASSWORD),
    })
    expect(await featured.json()).toEqual({ ok: true, message: 'Sponsored provider set.' })

    const bad = new FormData()
    bad.set('providerId', String(providerId))
    bad.set('affiliateNetwork', 'impact')
    bad.set('affiliateUrlTemplate', 'http://not-https.example/?c={clickId}')
    bad.set('commissionNote', '')
    const response = await request('/admin/api/providers/affiliate', {
      method: 'POST',
      body: bad,
      headers: basic(PASSWORD),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).message).toBe('The template must use https.')
  })
})
