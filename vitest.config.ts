import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The Playwright e2e suite runs separately via `npm run e2e`.
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        // Queries against a real (in-memory, local) D1: each file starts its
        // own through wrangler's getPlatformProxy, which takes a few seconds.
        extends: true,
        test: {
          name: 'db',
          include: ['test/db/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
