# PakRemits code audit

Audit date: 13 September 2026

> A record of the code at that date. The cron, Postgres and Fly.io sections
> describe the setup the site had before it moved to Cloudflare in October 2026;
> README.md describes the current one.

## Outcome

The public route map, API handlers, server actions, database access, provider adapters,
notification paths, cron workflow, and deployment configuration were reviewed. ESLint,
TypeScript, and all 175 unit tests pass after the fixes listed below. `npm audit
--omit=dev` reports no production dependency vulnerabilities.

No broken public link or missing local asset was found in the checked-in route builders.
All configured corridor, rate, method, provider, comparison, static, API, admin, and alert
paths resolve to an App Router route or an explicit rewrite. Direct visits to the old
internal corridor/rate/method paths did produce 404s (or, for Urdu, duplicate URLs); they
now redirect to the supported public URLs.

The full production build compiles, type-checks, and generates all 58 static pages when
run without a build-time database. A build with the checked-in local environment waits on
an offline PostgreSQL endpoint during static generation. This is an environment/backend
availability issue, and it can make page generation exceed Next.js's 60-second retry
threshold.

## Fixes implemented during this audit

- Added permanent redirects from `/corridor/*`, `/rate/*`, `/method/*`, and their Urdu
  equivalents to the documented public URL forms.
- Reject invalid locale segments in data-driven pages before starting database reads.
  Unknown paths now return a prompt 404 even when PostgreSQL is unavailable.
- Added the Urdu internal route prefixes to `robots.txt` so crawlers do not index router
  implementation paths.
- Replaced an invalid Tailwind arbitrary selector for the Chromium details marker with a
  valid plain CSS rule. This removes the generated-CSS parser warning.
- Added global `nosniff`, clickjacking, referrer, permissions, and HSTS headers, and
  disabled the `X-Powered-By` response header.
- Validate the comparison analytics cookie as a version-4 UUID before writing it to the
  database. Invalid or attacker-controlled values are replaced.
- Delete a newly-created email alert when its confirmation message cannot be sent. A
  retry now sends a fresh link instead of being incorrectly treated as a successful
  duplicate.
- Changed the scheduled workflow so a failed cache-revalidation request fails the job.
  Previously the workflow stayed green while deployed pages could remain stale.
- Fixed `/providers` database fallback handling so a missing build-time database is
  caught even when the lazy database client throws before constructing a promise.

## Security findings and suggested improvements

### High priority

1. **Verify ownership of phone destinations.** SMS and WhatsApp alerts become active as
   soon as any visitor submits a valid number. An attacker can use the site to message or
   incur costs against arbitrary phone numbers. Add a one-time verification challenge,
   and keep the alert inactive until the code is confirmed.
2. **Add durable abuse controls to `/api/alerts` and `/api/quotes`.** The per-contact alert
   cap and per-cookie comparison deduplication do not limit a caller who rotates contacts
   or cookies. Add an edge/WAF limit plus a shared server-side limiter keyed by a
   privacy-preserving client identifier. Set a request body size limit for alert signup.
3. **Stop deleting alerts on an ordinary GET.** Mail scanners and security products often
   prefetch links. The current GET unsubscribe can therefore delete an alert before its
   owner clicks it. Make GET show a confirmation page and retain the RFC 8058 POST handler
   for provider-driven one-click unsubscribe.

### Medium priority

4. **Add a Content Security Policy.** The new baseline headers reduce common browser
   risks, but CSP is the main remaining browser control. Build it with nonces or hashes
   compatible with Next.js scripts, Plausible, and any future third-party assets; test it
   in report-only mode first.
5. **Protect admin login attempts at the edge.** HTTP Basic auth uses a constant-time
   password comparison and locks closed when `ADMIN_PASSWORD` is absent, but it has no
   brute-force rate limit or second factor. Put `/admin` behind Fly access controls, an
   identity-aware proxy, or another edge authentication layer.
6. **Upgrade vulnerable development tooling.** The production dependency tree is clean.
   The full `npm audit` reports six moderate development-only findings through Vitest
   3.x and Drizzle Kit's legacy esbuild loader. Upgrade Vitest to a release containing
   `@vitest/mocker >= 4.1.11` after checking its migration notes. Do not apply npm's
   suggested Drizzle Kit downgrade blindly; move to a tested upstream release whose
   dependency tree no longer contains `esbuild <= 0.24.2`.
7. **Validate all outbound provider URLs at read time.** Affiliate templates are limited
   to HTTPS in the admin form, but provider homepage values are trusted from the database.
   Parse the final redirect target and require `https:` before returning a `Location`
   header. Consider an allowlist of provider and approved affiliate-network hosts.
8. **Limit stored request metadata.** Bound and normalize UTM values and referrer strings
   before inserting affiliate clicks. This avoids database growth from deliberately long
   headers or query strings.

## Backend and functionality findings

1. **Fail fast when PostgreSQL is unavailable.** The local configured database refused
   connections and static generation repeatedly hit the page timeout. Add an explicit
   short `connect_timeout` and distinguish transient database failure from empty data in
   operational logs.
2. **Add a health endpoint.** Provide a cheap liveness route that does not query external
   providers, plus a readiness check that verifies the database and required schema.
   Use these for Fly health checks and deployment gating.
3. **Avoid silent empty-page degradation for sustained outages.** Several public reads
   catch database errors and render empty states with HTTP 200. That keeps the site up,
   but monitoring can mistake a broad database outage for valid zero data. Emit a metric
   or structured error event and show an explicit temporary-unavailability state.
4. **Do not use the 60-second HTTP refresh route for the full grid.** The code documents
   an approximately four-minute run while the route declares `maxDuration = 60`. Remove
   the manual HTTP path or make it enqueue an isolated job and return `202 Accepted`.
5. **Continue proof-layer work after one substep fails.** All proof refresh operations sit
   in one `try` block. If benchmark refresh fails, leader detection, rollup, pruning, and
   cache invalidation are skipped. Guard each independent step and record its status.
6. **Keep locale in page-local links.** Shared navigation uses the route helpers correctly,
   but several links inside localized pages are hard-coded to English paths. They resolve,
   so they are not 404s, but an Urdu reader is unexpectedly moved to English. Pass the
   active locale through `homePath`, `providerPath`, `corridorPath`, `ratePath`, and
   `staticPath` everywhere.
7. **Expand end-to-end route coverage.** Current browser tests cover the home flow and a
   small page sample. Add a generated route-smoke suite that visits every sitemap URL,
   asserts status below 400, checks canonical/hreflang targets, and verifies that every
   same-origin link resolves.
8. **Remove source comments from public copy.** Method content includes visible
   `// NEEDS VERIFICATION` strings. Replace these with verified limits or omit the
   paragraphs before launch.

## Cron configuration

The schedule lives in `.github/workflows/refresh-rates.yml`, not in the Next.js app or
Vercel. GitHub Actions runs it at 7, 22, 37, and 52 minutes past each hour (UTC) and also
permits manual dispatch. The offset avoids GitHub's busiest top-of-hour scheduling window.
The workflow prevents overlapping runs with the `refresh-rates` concurrency group and
allows 15 minutes per run.

Each run checks out the repository, installs Node 22 dependencies with `npm ci`, and runs
`npm run refresh`. That invokes `scripts/refresh-local.ts`, which loads the environment
and calls `runFullRefresh('refresh-rates')` in `lib/cron/run.ts` directly against
PostgreSQL. The refresh records a `cron_runs` row, refreshes mid-market data and provider
quotes, prunes old data, evaluates alerts, and updates the proof/aggregate layer.

After a successful refresh, the workflow POSTs to `/api/cron/revalidate` with
`x-cron-secret`. The route compares `CRON_SECRET` in constant time and invalidates the
`quotes` cache tag. Required GitHub configuration is:

- Secrets: `DATABASE_URL`, `CRON_SECRET`
- Variables: `SITE_URL`, and optionally `BHEJO_DISABLED_ADAPTERS`

The direct `/api/cron/refresh-rates` GET route uses the same secret and implementation,
but it is unsuitable for the documented four-minute production run because its maximum
duration is 60 seconds.

## Fly.io deployment assessment

**Ready for Fly Launch.** The application is a standard Node/Next.js 16 server, stores
durable state in external PostgreSQL, and does not depend on a writable local filesystem.
`next.config.ts` now enables `output: 'standalone'`, which Fly Launch detects when it
generates an optimized multi-stage `Dockerfile` and `fly.toml`. A database-independent
`/api/health` route is available for its HTTP service check. See the official
[Next.js on Fly guide](https://fly.io/nextjs/) and
[deployment documentation](https://fly.io/docs/launch/deploy/).

The deployment files are intentionally left for `fly launch --no-deploy` to create,
because that interactive step registers the app and chooses its name, organization, and
region. After generation:

1. Review the generated Dockerfile and verify it copies `public` and `.next/static` into
   the standalone runtime image.
2. Configure `fly.toml` for internal port 3000, HTTPS enforcement, one initial Machine,
   and an HTTP health check on `/api/health`. Start with one Machine because Next's
   filesystem cache and tag invalidation are instance-local; use shared cache coordination
   before scaling out.
3. Set runtime secrets with `fly secrets set`: `DATABASE_URL`, `CRON_SECRET`,
   `ADMIN_PASSWORD`, and notification credentials. Fly injects secrets as environment
   variables at Machine boot; see [Fly secrets](https://fly.io/docs/apps/secrets/).
4. Supply `NEXT_PUBLIC_SITE_URL` as a Docker build argument as well as runtime config.
   Next.js inlines `NEXT_PUBLIC_*` values during the image build.
5. Run Drizzle migrations as an explicit release/one-off command with `DIRECT_URL`; do
   not run them concurrently on every web Machine.
6. Keep the existing GitHub Actions schedule and change `SITE_URL` to the Fly hostname.
   It already runs the long refresh independently of the web Machine. Fly's native
   scheduled Machines only offer fuzzy hourly/daily/weekly/monthly intervals, while the
   project's required cadence is 15 minutes. Fly also documents Cron Manager or a single
   Supercronic process for precise schedules: [task scheduling options](https://fly.io/docs/blueprints/task-scheduling/).
7. Decide how initial static pages obtain quote data. If the database is unavailable to
   the image builder, the defensive fallbacks can bake empty pages into the image until
   runtime revalidation. Either provide controlled build-time database access or warm and
   revalidate the site immediately after deployment.

Recommended initial region: place the Fly Machine close to the Supabase database rather
than close only to readers, because most server-rendered requests perform database reads.
Measure before adding regions; multi-region deployment also requires shared cache and
revalidation coordination.

## Verification checklist

- `npm run lint` — passes
- `npm run typecheck` — passes
- `npm test` — 175/175 pass
- `npm audit --omit=dev` — zero known production vulnerabilities
- `npm audit` — six moderate development-only findings, recorded above
- `npm run build` with the local environment intentionally hidden — passes; all 58 static
  pages generated. Expected database-unavailable fallback messages are logged.
- Standalone production server — generated successfully; `/`, `/api/health`, and a traced
  static font asset return HTTP 200 from `.next/standalone/server.js`.
- Production route smoke check — representative English/Urdu/static/dynamic URLs return
  200; legacy internal URLs return 308 to public equivalents; unknown locale paths return
  404 in under 300 ms; baseline security headers are present.
- Playwright end-to-end suite — not run because it requires a running, migrated, seeded
  PostgreSQL database with quote data
