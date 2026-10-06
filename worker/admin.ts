/**
 * /admin pages and their /admin/api endpoints, behind one password.
 *
 * HTTP Basic auth against ADMIN_PASSWORD (lib/admin/basic-auth.ts): no session
 * table, no login page, no cookie to leak. The pages are static files that
 * load their data from /admin/api/*, so both are checked here, on every
 * request.
 *
 * A single shared password is the only factor, so guessing must be slow:
 * after MAX_FAILURES wrong answers from one IP, every attempt is refused until
 * the window ends. The count lives in D1, since a Worker runs in many
 * isolates at once.
 */
import { desc, eq } from 'drizzle-orm'
import {
  saveAffiliateSettings,
  saveBenchmark,
  saveManualQuote,
  setFeaturedProvider,
  unpinBenchmark,
} from '@/lib/admin/actions'
import { isAdminAuthorization } from '@/lib/admin/basic-auth'
import {
  adapterHealth,
  alertStats,
  clickTotals,
  clicksByDay,
  monetisationGap,
  proofByDay,
  providerSettings,
  recentCronRuns,
} from '@/lib/admin/stats'
import { REFRESH_INTERVAL_MINUTES, STALE_AFTER_MS } from '@/lib/cadence'
import { db } from '@/lib/db'
import { corridors, providers, rateQuotes } from '@/lib/db/schema'
import { countHit, isOverLimit } from '@/lib/limits'
import { listBenchmarks } from '@/lib/proof/benchmarks'
import { evaluateClaims } from '@/lib/proof/claims'
import { getProofStats } from '@/lib/proof/stats'
import { clientIp } from '@/lib/rate-limit'
import type { Env } from './env'
import { json, readFields } from './http'

/** Wrong passwords allowed per IP per window before every attempt is refused. */
const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 15 * 60 * 1000

/** Publish now runs the deploy workflow; this many an hour is plenty. */
const PUBLISHES_PER_HOUR = 6

function unauthorised(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="PakRemits admin", charset="UTF-8"' },
  })
}

/** Null when the request carries the admin password; otherwise the refusal. */
async function refuse(request: Request): Promise<Response | null> {
  if (!process.env.ADMIN_PASSWORD) {
    console.error('[admin] ADMIN_PASSWORD is not set: locking /admin')
    return unauthorised()
  }

  const failureKey = `admin-fail:${clientIp(request)}`
  if (await isOverLimit(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS)) {
    return new Response('Too many attempts. Try again later.', {
      status: 429,
      headers: { 'retry-after': String(FAILURE_WINDOW_MS / 1000) },
    })
  }

  const authorization = request.headers.get('authorization')
  if (isAdminAuthorization(authorization)) return null

  // The browser's first request carries no credentials at all; only count
  // real wrong answers.
  if (authorization) await countHit(failureKey, MAX_FAILURES, FAILURE_WINDOW_MS)
  return unauthorised()
}

/** /admin and /admin/*: the static admin pages, once the password checks out. */
export async function handleAdminPage(request: Request, env: Env): Promise<Response> {
  const refusal = await refuse(request)
  if (refusal) return refusal

  const page = await env.ASSETS.fetch(request)
  const headers = new Headers(page.headers)
  headers.set('cache-control', 'no-store')
  return new Response(page.body, { status: page.status, statusText: page.statusText, headers })
}

/** The last 60 quotes, so a bad number is easy to spot. */
async function recentQuotes() {
  return db
    .select({
      id: rateQuotes.id,
      provider: providers.name,
      corridor: corridors.fromCountryName,
      currency: corridors.fromCurrency,
      method: rateQuotes.deliveryMethod,
      amountSent: rateQuotes.amountSent,
      rate: rateQuotes.rate,
      fee: rateQuotes.fee,
      amountReceived: rateQuotes.amountReceived,
      source: rateQuotes.source,
      stale: rateQuotes.stale,
      capturedAt: rateQuotes.capturedAt,
    })
    .from(rateQuotes)
    .innerJoin(providers, eq(rateQuotes.providerId, providers.id))
    .innerJoin(corridors, eq(rateQuotes.corridorId, corridors.id))
    .orderBy(desc(rateQuotes.capturedAt))
    .limit(60)
}

/**
 * Publish now: start the deploy workflow, which rebuilds the site from the
 * database without a fresh refresh, so admin edits go live in a few minutes
 * rather than at the next daily build.
 */
async function publish(): Promise<Response> {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  if (!token) return json({ ok: false, message: 'Publishing is not set up: GITHUB_DISPATCH_TOKEN is missing.' }, 503)
  if (!(await countHit('publish', PUBLISHES_PER_HOUR, 60 * 60 * 1000))) {
    return json({ ok: false, message: 'Published several times in the last hour already. Try again later.' }, 429)
  }

  const repo = process.env.GITHUB_REPOSITORY ?? 'pakremits/pakremits'
  const workflow = process.env.PUBLISH_WORKFLOW ?? 'daily.yml'
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'pakremits-admin',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ ref: process.env.PUBLISH_REF ?? 'main', inputs: { deploy_only: 'true' } }),
  })

  if (response.status !== 204) {
    console.error('[admin] publish failed:', response.status, await response.text().catch(() => ''))
    return json({ ok: false, message: `GitHub refused the run (HTTP ${response.status}).` }, 502)
  }
  return json({ ok: true, message: 'Publishing. The site updates in a few minutes.' })
}

const READS: Record<string, () => Promise<unknown>> = {
  async dashboard() {
    const [totals, byDay, alerts, health, crons, gap] = await Promise.all([
      clickTotals(),
      clicksByDay(14),
      alertStats(),
      // Fresh or not is judged over the stale threshold, not a fixed 24 hours.
      adapterHealth(STALE_AFTER_MS / 3_600_000),
      recentCronRuns(),
      monetisationGap(),
    ])
    return { totals, byDay, alerts, health, crons, gap, refreshIntervalMinutes: REFRESH_INTERVAL_MINUTES }
  },

  async proof() {
    const [stats, series, benchmarks] = await Promise.all([
      getProofStats({ fresh: true }),
      proofByDay(30),
      listBenchmarks(),
    ])
    // The live gap depends on a visitor's corridor and amount, which do not
    // exist here; the page lists it as "varies" rather than as hidden.
    return { stats, series, benchmarks, claims: evaluateClaims({ stats, liveGapOnStandardAmount: null }) }
  },

  async providers() {
    return { providers: await providerSettings() }
  },

  async quotes() {
    const [providerRows, corridorRows, quotes] = await Promise.all([
      db.select({ id: providers.id, name: providers.name }).from(providers).orderBy(providers.name),
      db
        .select({ id: corridors.id, name: corridors.fromCountryName, currency: corridors.fromCurrency })
        .from(corridors)
        .orderBy(corridors.fromCountryName),
      recentQuotes(),
    ])
    return { options: { providers: providerRows, corridors: corridorRows }, quotes }
  },
}

const WRITES: Record<string, (fields: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>> = {
  benchmarks: saveBenchmark,
  'benchmarks/unpin': unpinBenchmark,
  'providers/affiliate': saveAffiliateSettings,
  'providers/featured': setFeaturedProvider,
  quotes: saveManualQuote,
}

/** /admin/api/{name}: GET reads a page's data; POST runs one of its forms. */
export async function handleAdminApi(request: Request, name: string): Promise<Response> {
  const refusal = await refuse(request)
  if (refusal) return refusal

  if (request.method === 'GET' && READS[name]) return json(await READS[name]())

  if (request.method === 'POST') {
    if (name === 'publish') return publish()
    const write = WRITES[name]
    if (write) {
      const result = await write(await readFields(request))
      return json(result, result.ok ? 200 : 400)
    }
  }

  return json({ error: 'Not found' }, 404)
}
