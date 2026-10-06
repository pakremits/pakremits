# End-to-end tests

These drive a real browser against the built site, served the way production
serves it (the static files and the Worker, through `wrangler dev`), so they
need a local D1 with live quotes and a build:

```bash
npm run db:migrate:local && npm run seed && npm run refresh
npm run build
npm run e2e
```

`npm run e2e` starts `npm run preview` (wrangler dev on 127.0.0.1:8787) unless
one is already running. Set `E2E_BASE_URL` to run against another deployment,
such as the preview Worker.

`npm run refresh` takes a few minutes — it walks every corridor, method and
amount with polite per-host throttling.

The suite asserts on *behaviour*, not on specific rates. Which provider wins
changes daily and a test pinned to "Remitly is first" would fail on a
promotional rate expiring. What it does assert is that the table is ordered by
rupees received, that the gold highlight tracks the most rupees regardless of
the visible sort, and that the ranking cannot be moved by sponsorship.
