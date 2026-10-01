import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/health/route'

afterEach(() => vi.unstubAllEnvs())

describe('/api/health', () => {
  it('reports the commit baked into the image, so a deploy can confirm what is serving', async () => {
    vi.stubEnv('GIT_SHA', '4c8ed3c0a1b2c3d4e5f60718293a4b5c6d7e8f90')
    const response = GET()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      ok: true,
      service: 'pakremits',
      commit: '4c8ed3c0a1b2c3d4e5f60718293a4b5c6d7e8f90',
    })
  })

  it('reports no commit for an image built outside the pipeline', async () => {
    vi.stubEnv('GIT_SHA', '')
    expect((await GET().json()).commit).toBeNull()
  })
})
