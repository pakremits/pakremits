import { describe, expect, it } from 'vitest'
import { CORRIDORS } from '@/lib/corridors'
import { corridorForTimeZone } from '@/lib/visitor-corridor'

describe('corridorForTimeZone', () => {
  it.each([
    ['Europe/London', 'uk'],
    ['Asia/Dubai', 'uae'],
    ['Asia/Riyadh', 'saudi-arabia'],
    ['Asia/Qatar', 'qatar'],
    ['America/New_York', 'usa'],
    ['America/Indiana/Knox', 'usa'],
    ['Pacific/Honolulu', 'usa'],
    ['America/Toronto', 'canada'],
    ['America/St_Johns', 'canada'],
    ['Australia/Sydney', 'australia'],
    ['Europe/Berlin', 'eurozone'],
    ['Atlantic/Canary', 'eurozone'],
  ])('%s → %s', (zone, slug) => {
    expect(corridorForTimeZone(zone)).toBe(slug)
  })

  it.each(['Asia/Karachi', 'Europe/Zurich', 'Europe/Warsaw', 'America/Mexico_City', 'UTC', ''])(
    'leaves %s outside the corridors',
    (zone) => {
      expect(corridorForTimeZone(zone)).toBeNull()
    },
  )

  it('only returns real corridor slugs', () => {
    const slugs = new Set(CORRIDORS.map((c) => c.slug))
    for (const zone of Intl.supportedValuesOf('timeZone')) {
      const slug = corridorForTimeZone(zone)
      if (slug) expect(slugs).toContain(slug)
    }
  })
})
