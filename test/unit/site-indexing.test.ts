import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import { searchIndexingEnabled } from '@/lib/seo'

afterEach(() => vi.unstubAllEnvs())

describe('site crawler policy', () => {
  it('lets crawlers in to see the noindex, but submits no sitemap, when indexing is off', () => {
    // Staging is kept out of search by noindex (X-Robots-Tag and the robots
    // meta tag). A `Disallow: /` would stop crawlers from ever reading it.
    vi.stubEnv('ROBOTS_ALLOW_INDEXING', 'false')
    expect(searchIndexingEnabled()).toBe(false)
    const policy = robots()
    expect(policy.rules).toMatchObject([{ userAgent: '*', allow: '/' }])
    expect(policy.sitemap).toBeUndefined()
  })

  it('always keeps private and tracking routes out', () => {
    for (const value of ['false', 'true']) {
      vi.stubEnv('ROBOTS_ALLOW_INDEXING', value)
      const [rule] = robots().rules as { disallow: string[] }[]
      expect(rule.disallow).toEqual(expect.arrayContaining(['/admin', '/api/', '/go/', '/alerts/']))
    }
  })

  it('advertises the sitemap only after the production switch', () => {
    vi.stubEnv('ROBOTS_ALLOW_INDEXING', 'true')
    expect(searchIndexingEnabled()).toBe(true)
    const policy = robots()
    expect(policy.rules).toMatchObject([{ userAgent: '*', allow: '/' }])
    expect(policy.sitemap).toBe('http://localhost:3000/sitemap.xml')
  })
})
