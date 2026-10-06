import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstile } from '@/lib/alerts/turnstile'

afterEach(() => vi.unstubAllGlobals())

describe('Turnstile signup verification', () => {
  it('accepts only a successful token for this site', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: 'stage.pakremits.com' }),
    }))
    expect(await verifyTurnstile('token', 'stage.pakremits.com')).toBe(true)
    expect(await verifyTurnstile('token', 'pakremits.com')).toBe(false)
  })

  it("skips the hostname only for Cloudflare's test key, and never in production", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } }),
    }))
    expect(await verifyTurnstile('token', '127.0.0.1')).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'a-real-secret')
    expect(await verifyTurnstile('token', '127.0.0.1')).toBe(false)
    vi.unstubAllEnvs()
  })

  it('fails closed on validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))
    expect(await verifyTurnstile('token', 'stage.pakremits.com')).toBe(false)
    expect(await verifyTurnstile('', 'stage.pakremits.com')).toBe(false)
  })
})
