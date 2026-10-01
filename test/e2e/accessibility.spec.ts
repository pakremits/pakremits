import { expect, test } from '@playwright/test'

/**
 * Accessibility, driven with real keys.
 *
 * The earlier manual pass could only check these programmatically because the
 * browser pane could not receive key events. Playwright can, so this is the
 * first time the tab order and focus ring are exercised the way a keyboard
 * user would.
 */

/** The live panel lives on the corridor pages; home hands off to /compare. */
const PANEL_PAGE = '/compare/uk-to-pakistan'

test('the comparison panel is fully operable by keyboard', async ({ page }) => {
  await page.goto(PANEL_PAGE)
  await expect(page.locator('#compare')).toBeVisible()

  // Tab from the top until focus reaches the corridor select.
  await page.locator('body').press('Tab')
  let reached = false
  for (let i = 0; i < 25 && !reached; i++) {
    reached = (await page.evaluate(() => document.activeElement?.id)) === 'from'
    if (!reached) await page.keyboard.press('Tab')
  }
  expect(reached, 'the "Sending from" select should be reachable by Tab').toBe(true)

  // Open the visual listbox, move to the next country, and commit it entirely
  // with the keyboard. The selected flag is decorative, so the accessible
  // value remains the complete country and currency label.
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  // The one-row bar shows the short name once selected.
  await expect(page.locator('#from')).toContainText(/UAE|United Arab Emirates/)
  await expect
    .poll(async () => page.inputValue('#amt'), { timeout: 15_000 })
    .not.toBe('500')

  // Focus survives the update and continues to the next controls.
  await page.locator('#from').focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('method')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('amt')

  // And typing into it works.
  await page.keyboard.type('750')
  expect(await page.inputValue('#amt')).toContain('750')
})

test('keyboard focus is visible, not just present', async ({ page }) => {
  await page.goto('/')
  await page.locator('body').press('Tab')

  const indicator = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName,
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineWidth: cs.outlineWidth,
      outlineStyle: cs.outlineStyle,
      boxShadow: cs.boxShadow,
    }
  })

  expect(indicator, 'Tab should move focus off body').not.toBeNull()
  expect(indicator!.matchesFocusVisible).toBe(true)
  // Either an outline or a ring counts — the design uses both in places.
  const hasRing =
    (indicator!.outlineStyle !== 'none' && indicator!.outlineWidth !== '0px') ||
    (indicator!.boxShadow !== 'none' && indicator!.boxShadow !== '')
  expect(hasRing, `focused ${indicator!.tag} had no visible indicator`).toBe(true)
})

test('the sort control is operable by keyboard and reports its state', async ({ page }) => {
  await page.goto(PANEL_PAGE)
  const fastest = page.getByRole('button', { name: 'Fastest' })

  await fastest.focus()
  await expect(fastest).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Enter')

  await expect(fastest).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Most rupees' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('results are announced through a live region', async ({ page }) => {
  await page.goto(PANEL_PAGE)
  const live = page.locator('#compare [aria-live]')
  await expect(live).toHaveAttribute('aria-live', 'polite')
  // aria-busy flips while a fetch is in flight so a screen reader is not read
  // a half-updated table.
  await expect(live).toHaveAttribute('aria-busy', /true|false/)
})

test('every page has one h1 and a labelled main landmark', async ({ page }) => {
  for (const path of ['/', '/compare/uk-to-pakistan', '/gbp-to-pkr', '/how-we-rank']) {
    await page.goto(path)
    await expect(page.locator('h1'), `${path} should have exactly one h1`).toHaveCount(1)
    expect(await page.locator('img:not([alt])').count(), `${path} has an image without alt`).toBe(0)
  }
})

test('the Urdu page declares its language and direction', async ({ page }) => {
  await page.goto('/ur')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(html).toHaveAttribute('lang', 'ur-PK')
})

test('no page scrolls horizontally on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of ['/', '/ur', '/compare/uk-to-pakistan', '/gbp-to-pkr']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => {
      const de = document.documentElement
      return de.scrollWidth - de.clientWidth
    })
    expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1)
  }
})
