/**
 * Alert management tokens.
 *
 * One token per alert grants every self-service action on it: confirm the
 * double opt-in, view it, and unsubscribe. That is deliberate — all three are
 * "manage my own alert", and a second token would double the surface without
 * protecting anything a reader of the first could not already do.
 *
 * 32 random bytes, base64url so it survives being a path segment and being
 * pasted out of an email client that mangles punctuation. Web Crypto, so the
 * same module runs in the Worker, in Node and in the browser.
 */
export function generateAlertToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Token shape check before touching the database.
 *
 * Cheap rejection of the obviously-invalid, so a scanner hammering
 * /alerts/manage/<junk> does not turn into a query per request.
 */
export function isPlausibleToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(value)
}
