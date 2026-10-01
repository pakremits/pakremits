import { describe, expect, it } from 'vitest'
import { CORRIDORS } from '@/lib/corridors'
import { CORRIDOR_CONTENT } from '@/lib/content/corridors'
import { publicPageMetadata } from '@/lib/seo'

describe('public page metadata', () => {
  it('keeps search and social URLs on the public route', () => {
    const metadata = publicPageMetadata({
      title: 'Send money from the UK to Pakistan | PakRemits',
      description: 'Compare transfer rates and fees.',
      path: '/compare/uk-to-pakistan',
      image: '/og/corridor/uk.png',
    })
    expect(metadata.alternates).toEqual({ canonical: '/compare/uk-to-pakistan' })
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      url: 'http://localhost:3000/compare/uk-to-pakistan',
      images: [{ url: 'http://localhost:3000/og/corridor/uk.png' }],
    })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  it('has distinct descriptions for every country corridor', () => {
    const descriptions = CORRIDORS.map((corridor) => CORRIDOR_CONTENT[corridor.fromCurrency].metaDescription)
    expect(new Set(descriptions).size).toBe(CORRIDORS.length)
    expect(descriptions.every((description) => description.includes('Pakistan'))).toBe(true)
  })
})
