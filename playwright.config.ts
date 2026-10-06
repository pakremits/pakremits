import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end config.
 *
 * Runs against the built site served the way production serves it: the
 * static files and the Worker, through `wrangler dev` (`npm run preview`).
 * `reuseExistingServer` locally so a run does not fight one you already have
 * open; set E2E_BASE_URL to test any other deployment instead. The suite needs
 * a seeded local D1 with live quotes and a build — see test/e2e/README.md.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8787'

export default defineConfig({
  testDir: './test/e2e',
  // The comparison panel debounces at 350ms and then waits on a network round
  // trip, so assertions need more headroom than the 5s default.
  expect: { timeout: 10_000 },
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],

  use: {
    baseURL,
    // E2E_CHANNEL=chrome runs the installed Chrome instead of Playwright's
    // own download (`npx playwright install`).
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
