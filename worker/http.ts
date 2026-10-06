/** Small response helpers shared by the Worker's routes. */

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...Object.fromEntries(new Headers(headers)) },
  })
}

/** A redirect to a path on this site, or to any absolute URL. */
export function redirect(to: string | URL, base: URL, status = 302): Response {
  return new Response(null, {
    status,
    headers: { location: new URL(to, base).toString(), 'cache-control': 'no-store' },
  })
}

/**
 * The headers out/_headers gives every static file, for the responses the
 * Worker makes itself. A route's own value wins.
 */
export function withSiteHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers)
  const defaults: [string, string][] = [
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    // Alert URLs carry a capability token: never send it on as a referrer.
    [
      'referrer-policy',
      url.pathname.startsWith('/alerts/') ? 'no-referrer' : 'strict-origin-when-cross-origin',
    ],
    ['strict-transport-security', 'max-age=63072000; includeSubDomains'],
    ...(process.env.ROBOTS_ALLOW_INDEXING === 'true'
      ? []
      : ([['x-robots-tag', 'noindex, nofollow']] as [string, string][])),
  ]
  for (const [name, value] of defaults) if (!headers.has(name)) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/** The request body as form fields, from either an HTML form or JSON. */
export async function readFields(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  }
  return Object.fromEntries((await request.formData()).entries())
}
