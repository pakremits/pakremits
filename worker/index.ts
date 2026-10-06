/**
 * The PakRemits Worker.
 *
 * The site itself is static files (out/), which Cloudflare serves without
 * running this code. wrangler.jsonc routes only the paths that need a server
 * here first (`run_worker_first`): /go, /api, /alerts and /admin. Each is a
 * few D1 queries and no rendering, well inside the free plan's 10 ms of CPU.
 *
 *   GET  /go/{provider}                 affiliate redirect, click and savings rows
 *   GET  /api/health                    liveness and the deployed commit
 *   POST /api/events                    the comparison beacon
 *   POST /api/alerts                    alert sign-up
 *   GET  /alerts/confirm/{token}        double opt-in link
 *   GET  /alerts/manage/{token}         manage link, on to the static page
 *   *    /alerts/unsubscribe/{token}    unsubscribe (GET confirms first)
 *   *    /api/alerts/manage/{token}     the manage page's data and changes
 *   *    /admin, /admin/*               admin pages, behind the password
 *   *    /admin/api/{name}              admin data and forms, behind the password
 *
 * Anything else under those prefixes is a static page (/alerts/removed, say)
 * and is served from the assets.
 */
import { bindD1 } from '@/lib/db'
import { handleAdminApi, handleAdminPage } from './admin'
import {
  handleConfirm,
  handleManageApi,
  handleManageLink,
  handleSignup,
  handleUnsubscribe,
} from './alerts'
import type { Env, WorkerContext } from './env'
import { handleEvent } from './events'
import { handleGo } from './go'
import { json, withSiteHeaders } from './http'

async function route(request: Request, url: URL, env: Env, ctx: WorkerContext): Promise<Response> {
  const { pathname } = url
  const method = request.method
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [section, first, second, third] = segments

  if (section === 'go' && first && segments.length === 2 && method === 'GET') {
    return handleGo(request, url, first, ctx)
  }

  if (section === 'admin') {
    // Under /admin rather than /api so the browser sends the password it
    // already holds for the admin pages with every request.
    if (first === 'api' && second) return handleAdminApi(request, segments.slice(2).join('/'))
    return handleAdminPage(request, env)
  }

  if (section === 'api') {
    if (first === 'health' && method === 'GET') {
      return json({ ok: true, service: 'pakremits', commit: process.env.GIT_SHA || null })
    }
    if (first === 'events' && method === 'POST') return handleEvent(request, url, ctx)
    if (first === 'alerts' && !second && method === 'POST') return handleSignup(request)
    if (first === 'alerts' && second === 'manage' && third && segments.length === 4) {
      return handleManageApi(request, third)
    }
    return json({ error: 'Not found' }, 404)
  }

  if (section === 'alerts' && first && second && segments.length === 3) {
    if (first === 'confirm' && method === 'GET') return handleConfirm(url, second)
    if (first === 'manage' && method === 'GET') return handleManageLink(url, second)
    // /alerts/unsubscribe/confirm is the static confirmation page.
    if (first === 'unsubscribe' && second !== 'confirm') return handleUnsubscribe(request, url, second)
  }

  return env.ASSETS.fetch(request)
}

const worker = {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    bindD1(env.DB)
    const url = new URL(request.url)
    try {
      return withSiteHeaders(await route(request, url, env, ctx), url)
    } catch (error) {
      console.error(`[worker] ${request.method} ${url.pathname} failed:`, error)
      return withSiteHeaders(json({ error: 'Something went wrong.' }, 500), url)
    }
  },
}

export default worker
