import { expect, test, type Page } from '@playwright/test'

/**
 * The live comparison panel (corridor pages).
 *
 * Asserts behaviour, never a specific rate. Which provider wins changes hourly,
 * so a test pinned to "Remitly is first" would go red the moment a promotional
 * rate expired — and would have taught us nothing anyway. What matters is that
 * the table is ordered by rupees received and that the gold highlight follows
 * the most rupees.
 */

/** Parse "₨ 188,420" (or the Rs form some fonts render) into a number. */
function parsePkr(text: string): number {
  const digits = text.replace(/[^\d.]/g, '')
  return Number.parseFloat(digits)
}

/**
 * The results region, scoped to the panel.
 *
 * Scoped to the panel so any other live region on the page (the rate alert
 * dialog's status line) cannot trip Playwright's strict mode.
 */
const results = '#compare [aria-live]'

async function chooseOption(page: Page, controlId: string, optionName: string) {
  await page.locator(`#${controlId}`).click()
  // An option's name can carry its hint ("United Arab Emirates AED"), so match
  // on the leading label.
  await page.getByRole('option', { name: new RegExp(`^${optionName}\\b`) }).click()
}

test.beforeEach(async ({ page }) => {
  // The live panel moved off the home page, which now has a search form that
  // hands off to /compare. Corridor pages still carry it in full.
  await page.goto('/send-money-from-uk-to-pakistan')
  // Wait for the server-rendered table rather than a fixed sleep.
  // Visible matches only: the desktop column headings carry the same words
  // and are hidden on phones.
  await expect(
    page.locator(`${results} >> text=/Recipient gets|₨|Rs/ >> visible=true`).first(),
  ).toBeVisible()
})

test('ranks providers by rupees received, highest first', async ({ page }) => {
  const amounts = await page
    .locator(`${results} li b`)
    .allTextContents()
    .then((texts) => texts.map(parsePkr).filter((n) => Number.isFinite(n)))

  expect(amounts.length).toBeGreaterThanOrEqual(2)

  // The bank benchmark is pinned last and is not part of the merit ordering,
  // so compare only the rows above it.
  const providerAmounts = amounts.slice(0, -1)
  const sorted = [...providerAmounts].sort((a, b) => b - a)
  expect(providerAmounts).toEqual(sorted)
})

test('marks exactly one best deal, and it is the largest amount', async ({ page }) => {
  const best = page.locator(`${results} >> text="Best deal"`)
  await expect(best).toHaveCount(1)

  const rows = page.locator(`${results} li`)
  const bestRowAmount = parsePkr(
    (await rows.filter({ hasText: 'Best deal' }).locator('b').first().textContent()) ?? '',
  )

  const all = (await rows.locator('b').allTextContents())
    .map(parsePkr)
    .filter((n) => Number.isFinite(n))

  expect(bestRowAmount).toBe(Math.max(...all))
})

test('recomputes when the amount changes', async ({ page }) => {
  const first = page.locator(`${results} li b`).first()
  const before = parsePkr((await first.textContent()) ?? '')

  await page.fill('#amt', '1000')
  // Poll rather than sleep: the panel debounces then fetches.
  await expect
    .poll(async () => parsePkr((await first.textContent()) ?? ''), { timeout: 15_000 })
    .not.toBe(before)

  const after = parsePkr((await first.textContent()) ?? '')
  // Doubling the amount should roughly double what arrives.
  expect(after).toBeGreaterThan(before * 1.5)
})

test('resets the amount to the corridor default when the country changes', async ({ page }) => {
  await page.fill('#amt', '137')
  await chooseOption(page, 'from', 'United Arab Emirates')

  // £137 must not carry over as د.إ137 — the currencies differ by an order of
  // magnitude and the rates were captured at a different band.
  await expect.poll(async () => page.inputValue('#amt'), { timeout: 15_000 }).not.toBe('137')
  expect(Number(await page.inputValue('#amt'))).toBeGreaterThan(137)
})

test('drops providers that do not serve the chosen delivery method', async ({ page }) => {
  const namesFor = async () =>
    (await page.locator(`${results} li`).allTextContents()).join(' ')

  await chooseOption(page, 'method', 'Bank account')
  await expect.poll(namesFor, { timeout: 15_000 }).toContain('Wise')

  // Wise pays out to Pakistani bank accounts only.
  await chooseOption(page, 'method', 'JazzCash')
  await expect.poll(namesFor, { timeout: 15_000 }).not.toContain('Wise')
})

test('named bank accounts keep their labels and show bank-deposit quotes', async ({ page }) => {
  await chooseOption(page, 'method', 'Bank account')
  const bankRows = await page.locator(`${results} li b`).allTextContents()
  expect(bankRows.length).toBeGreaterThan(0)

  for (const account of ['SadaPay', 'NayaPay', 'Roshan Digital Account']) {
    await chooseOption(page, 'method', account)
    await expect(page.getByText(/general PKR bank-deposit quotes/i)).toBeVisible()
    await expect(page.locator('#method')).toContainText(account === 'Roshan Digital Account' ? 'RDA' : account)
    expect(await page.locator(`${results} li b`).allTextContents()).toEqual(bankRows)
  }
})

test('the fastest sort reorders rows but the gold highlight stays on the most rupees', async ({
  page,
}) => {
  const bestBefore = await page
    .locator(`${results} li`)
    .filter({ hasText: 'Best deal' })
    .locator('.font-display')
    .first()
    .textContent()

  await page.getByRole('button', { name: 'Fastest' }).click()
  await page.waitForTimeout(1500)

  const bestAfter = await page
    .locator(`${results} li`)
    .filter({ hasText: 'Best deal' })
    .locator('.font-display')
    .first()
    .textContent()

  // The order changes; which row is "best" does not.
  expect(bestAfter).toBe(bestBefore)
  await expect(page.locator(`${results} >> text="Best deal"`)).toHaveCount(1)
})

test('provider links are marked sponsored and carry the corridor and amount', async ({ page }) => {
  const cta = page.locator(`${results} a[href^="/go/"]`).first()
  await expect(cta).toHaveAttribute('rel', 'sponsored nofollow')

  const href = await cta.getAttribute('href')
  expect(href).toMatch(/corridor=\w+/)
  expect(href).toMatch(/amount=\d+/)
  expect(href).toMatch(/method=\w+/)
})

test('the affiliate redirect logs a click and leaves the site', async ({ page, context }) => {
  const href = await page.locator(`${results} a[href^="/go/"]`).first().getAttribute('href')

  // Follow it without leaving the test on an external page.
  const response = await context.request.get(href!, { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers()['location']).toMatch(/^https?:\/\//)
  // Never cache a redirect that mints a per-click tracking id.
  expect(response.headers()['cache-control']).toContain('no-store')
})

test('every quote carries a capture time', async ({ page }) => {
  await expect(page.locator('#compare')).toContainText(/Quotes captured \d{2}:\d{2} PKT/)
})

test('discloses the affiliate relationship on the page', async ({ page }) => {
  await expect(page.locator('#compare')).toContainText(/Some links pay us a commission/i)
  await expect(page.locator('footer')).toContainText(/We earn a commission from some providers/i)
})
