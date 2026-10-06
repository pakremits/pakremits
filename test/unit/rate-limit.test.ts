import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetRateLimits, allow, clientIp, isLimited } from '@/lib/rate-limit'
import { isAdminAuthorization } from '@/lib/admin/basic-auth'

afterEach(() => {
  __resetRateLimits()
  vi.useRealTimers()
})

describe('allow', () => {
  it('lets hits through up to the limit, then refuses for the rest of the window', () => {
    const results = Array.from({ length: 5 }, () => allow('k', 3, 60_000))
    expect(results).toEqual([true, true, true, false, false])
    expect(isLimited('k', 3)).toBe(true)
  })

  it('starts a fresh window once the old one ends', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 4; i++) allow('k', 3, 1_000)
    vi.advanceTimersByTime(1_001)
    expect(allow('k', 3, 1_000)).toBe(true)
  })

  it('keeps keys apart', () => {
    for (let i = 0; i < 3; i++) allow('a', 3, 60_000)
    expect(allow('a', 3, 60_000)).toBe(false)
    expect(allow('b', 3, 60_000)).toBe(true)
  })
})

describe('clientIp', () => {
  it("prefers Cloudflare's header, then the first X-Forwarded-For hop", () => {
    const cf = new Request('http://x', { headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } })
    const xff = new Request('http://x', { headers: { 'x-forwarded-for': '3.3.3.3, 10.0.0.1' } })
    expect(clientIp(cf)).toBe('1.1.1.1')
    expect(clientIp(xff)).toBe('3.3.3.3')
  })
})

describe('isAdminAuthorization', () => {
  const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`

  it('accepts the right password with any username', () => {
    expect(isAdminAuthorization(basic('anyone', 's3cret'), 's3cret')).toBe(true)
  })

  it('refuses a wrong password, a missing header and garbage', () => {
    expect(isAdminAuthorization(basic('admin', 'wrong'), 's3cret')).toBe(false)
    expect(isAdminAuthorization(null, 's3cret')).toBe(false)
    expect(isAdminAuthorization('Basic %%%', 's3cret')).toBe(false)
  })

  it('fails closed when no password is configured', () => {
    expect(isAdminAuthorization(basic('admin', ''), '')).toBe(false)
    expect(isAdminAuthorization(basic('admin', 'x'), undefined)).toBe(false)
  })
})
