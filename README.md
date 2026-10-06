# PakRemits

Compares money-transfer services sending to Pakistan, ranked by the exact PKR
amount that lands in the recipient's account. Not by rate, not by fee, not by
who pays us.

**Status: Phases 1–5 complete, with one number short of target.** The rate engine runs against live provider
APIs and the full public site renders from it — home, 8 corridor pages, 8 rate
pages, provider and head-to-head pages, method pages, and the static set, in
English (the Urdu locale is switched off for now). Every page is built ahead of
time and served as a static file.

Lighthouse mobile is **92** against the brief's target of 95. Desktop is 100
across all four categories. The gap and what is left to close it are in
[Performance](#performance) below. Six providers now have live collectors; see
[Provider access](#provider-access-as-verified-on-19-sep-2026) for why the rest
are not, which is the main open question for the project.

---

## What works today

```
npm run probe
```

```
Probing GBP → PKR, bank, 500 GBP
  mid-market: 375.114 (wise)

  provider   rate       fee     received        note
  Wise       375.1140   3.66    ₨ 186,184.08    205ms · In hours · markup 0.00%
  Remitly    377.1200   0.00    ₨ 188,560       757ms · 3–5 days · promo · markup -0.53%
```

- Two live adapters (Wise, Remitly) across all eight corridors, no API keys.
- Home page rendering live quotes, with the interactive comparison panel.
- Affiliate redirects at `/go/[provider]` logging clicks.
- robots.txt enforced on every outbound adapter request.
- Mid-market rates and 30-day history from Wise's public rates endpoints.
- `computeReceived` and the ranking rules, with 76 unit tests.
- A daily GitHub Actions run that refreshes the rates and republishes the site.
- Password-protected manual quote override at `/admin/quotes`.
- Rate alerts: double opt-in email, WhatsApp/SMS behind a swappable notifier,
  12-hour rate limiting, weekly digest, one-click unsubscribe that deletes.
- `/admin` dashboard: clicks by provider and corridor, alert volumes, adapter
  freshness, cron run history, and affiliate template management.

### Alerts without a Resend or Twilio account

`lib/notify/` falls back to a console notifier whenever credentials are absent,
so the entire pipeline — evaluation, rate limiting, message composition, trigger
recording — runs locally and prints the messages it would have sent. Sends are
marked `simulated`, and a trigger is still recorded, otherwise every local
refresh would re-fire the same alert.

**Alerts trigger on the best rate actually obtainable, not the mid-market rate.**
Nobody can get the mid-market rate, so an alert firing when it crosses 380 would
tell the recipient to act on a number they cannot have — and the message would
then have to read "crossed 380, best available 378.90". If no provider quote
exists for a corridor we do not fall back to mid-market; we simply do not fire.

---

## Local setup

Requires Node 22 (CI runs 22.19.0).

```bash
git clone <your-repo> pakremits && cd pakremits
npm install
cp .env.example .env.local      # optional: keys, and scripts against the real database
cp .dev.vars.example .dev.vars  # for npm run preview; set a test ADMIN_PASSWORD
```

### Database

The database is Cloudflare D1, which is SQLite. Locally it is a file under
`.wrangler/state` that wrangler creates and serves, so there is nothing to
install and no account needed. [README-DB.md](./README-DB.md) covers the schema,
the D1 limits worth knowing, and running scripts against the real database.

```bash
npm run db:migrate:local   # create the local database
npm run seed               # providers, corridors, 90 days of mid-market history
npm run refresh            # walks the full grid and writes live quotes
```

SadaPay, NayaPay, and Roshan Digital Account remain separate account choices in
the comparison selector. They display the existing `bank` quote and benchmark
rows, not separate account-specific prices. The UI labels these as general PKR
bank-deposit quotes and asks users to confirm account eligibility with the
provider. Legacy `neobank` and `rda` quote requests also resolve to the `bank`
rail; no new quote-collection jobs or database migration are needed.

The seed pulls 90 days of real history from Wise. If that call fails it writes a
deterministic synthetic walk marked `source: 'synthetic'`, so the charts render
on a fresh database and the fake data is trivially identifiable.

### Run it

| Command | What you get |
| --- | --- |
| `npm run dev` | The Next dev server at http://localhost:3000 with hot reload, reading the local database. For working on pages: the Worker's routes (`/go`, `/api`, `/alerts`, `/admin`) do not run here. |
| `npm run build && npm run preview` | The site as it is deployed: the static build and the Worker, through `wrangler dev` at http://127.0.0.1:8787. |

- `/admin` asks for HTTP Basic auth: any username, and `ADMIN_PASSWORD` from
  `.dev.vars` as the password.
- Without `RESEND_API_KEY`, alert emails print to the `wrangler dev` console.
- A build reads the database once. Rebuild after a refresh to see new quotes on
  the pages.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server on the local database |
| `npm run build` | The static site in `out/`, built from the local database |
| `npm run preview` | Serves `out/` with the Worker (`wrangler dev`, port 8787) |
| `npm test` | Unit tests, and the database tests on an in-memory D1 |
| `npm run typecheck` | `next typegen && tsc --noEmit`: route types first, as on a fresh checkout |
| `npm run probe` | Call every adapter live and print a comparison table |
| `npm run probe -- --from AED --amount 3000 --method wallet` | Probe one corridor |
| `npm run probe -- --save` | Re-capture test fixtures from live responses |
| `npm run refresh` | Full refresh into the local database |
| `npm run seed` | Idempotent seed |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate:local` | Apply pending migrations to the local database |
| `npm run db:migrate:remote` | The same against the real database (every publish does this first) |
| `npm run db:check` | Run each kind of query once and print a summary |
| `D1_TARGET=remote npm run db:contract` | Check the D1 REST API still behaves as the refresh expects |
| `npm run e2e` | Playwright end-to-end suite against `npm run preview` ([test/e2e/README.md](./test/e2e/README.md)) |
| `npm run e2e:ui` | The same, in Playwright's UI mode |

Scripts use the local database unless `D1_TARGET=remote` is set, with the three
D1 values from `.env.example`.

### URLs

Every public URL is a file in the static build. A folder cannot be a partial
segment like `[slug]-to-pakistan`, and a static site has no rewrites, so one
dynamic segment serves each family of pages and picks the template from the
slug: `app/(site)/compare/[slug]` serves the corridors
(`/compare/uk-to-pakistan`), the ways to receive (`/compare/jazzcash-transfers`)
and the head-to-heads (`/compare/remitly-vs-wise`), and `app/(site)/[rate]`
serves the rate pages (`/gbp-to-pkr`). Each lists its slugs in
`generateStaticParams`; any other slug is a 404.

**Never write an internal path by hand.** Every link goes through
`lib/routes.ts`. Old URLs (`/send-money-…`, `/corridor/…`, `/rate/…`,
`/method/…`, `/en/…`) redirect permanently through `out/_redirects`, which
`scripts/write-static-config.ts` writes after each build along with the headers
in `out/_headers`. Urdu is switched off for now, so `/ur` redirects temporarily
to the English home page.

---

## Deploying to Cloudflare

Everything runs on Cloudflare's free plan:

```
Visitor ─► Worker + static assets (Workers Free)
  ├─ static files, free and unlimited: every page, /data/quotes/*.json for the
  │    comparison panel, OG images, sitemap.xml, robots.txt
  └─ /go/*  /api/*  /alerts/*  /admin*  ─► worker/index.ts ─► D1
```

- **Pages are built, not rendered on request.** The free plan allows 10 ms of
  CPU per request, too little to render a Next.js page. Rates only change when
  the refresh runs, so the whole site is built from the database as static
  files (`output: 'export'`) right after each refresh and deployed with the
  Worker. Page views never reach the Worker or the database.
- **The Worker** (`worker/`) handles only what needs a server: affiliate
  redirects, alert sign-up and email links, the comparison beacon, the health
  check, and the admin. Each request is a few D1 queries and no rendering.
- **The comparison panel** loads `/data/quotes/{corridor}.json` and ranks in the
  browser with the same `lib/ranking/` code the build uses.
- **The refresh** runs on GitHub Actions, which has the Chromium the browser
  adapters need and time for a full pass, and writes to D1 over its REST API.

### Environments

Staging is the Worker `pakremits-staging` at https://stage.pakremits.com, with
the D1 database `pakremits-staging`. It is published from `main` through the
GitHub environment `staging`, and is the top level of `wrangler.jsonc`.

Production (`pakremits.com`) will be its own Worker and database: a
`production` env in `wrangler.jsonc` and a GitHub environment of the same name,
which `publish.yml` pairs up, with `ROBOTS_ALLOW_INDEXING=true` and a faster
refresh.

### The pipeline

| Workflow | Runs on | What it does |
| --- | --- | --- |
| `ci.yml` | PRs into `main`, pushes to `main` | `verify`: typecheck, lint, tests, a full static build on a seeded local database, and the Worker's bundle. `migrations`: applies every migration to an empty database, checks a second run applies nothing, and fails if `lib/db/schema.ts` has a change with no migration. On `main`, once both pass and the commit is still `main`'s tip, it publishes staging with the rates already in the database. |
| `daily.yml` | 05:07 and 11:07 UTC, or by hand | Refreshes the rates and publishes. The first tick each day does the work; the second only runs if the first did not, since GitHub's scheduler can drop a run. By hand, `force` refreshes even if one ran recently and `deploy_only` republishes without a refresh, which is what the admin's **Publish now** runs. |
| `publish.yml` | Called by both | The one way a release goes live, below. |

`publish.yml` runs one release at a time per environment, queued and never
cancelled halfway:

1. **Migrates.** Applies pending migrations to the database `wrangler.jsonc`
   binds as `DB`.
2. **Refreshes**, if asked and unless the last refresh is recent. An empty
   database is seeded first. Before writing anything it checks that the D1
   REST API still behaves as `lib/db/d1-http.ts` expects
   (`npm run db:contract`).
3. **Copies the database.** Exports D1 into a local copy for the build, and
   backs the export up to a private R2 bucket. Never to an Actions artifact:
   the repository is public and `rate_alerts` holds email addresses.
4. **Builds** the site from that copy: no API calls, and one consistent
   snapshot for every page.
5. **Deploys** the Worker and the site with `wrangler deploy`.
6. **Smoke-tests** the result. It waits for `/api/health` to report the new
   commit, checks the main pages and a data file return 200 with quotes in it,
   that `/ur` and an old URL redirect, and that staging still refuses indexing.
   It sends GET requests only and never touches `/go/*` or `/api/events`, which
   record the clicks and comparisons behind the public figures.
7. **Rolls back** with `wrangler rollback` if the smoke test fails. The job
   still fails, so someone looks.
8. **Records D1 usage** for the last 24 hours in the run's summary, against the
   free plan's daily allowance. The allowance is per Cloudflare account, so
   other projects on the same account count against it too.

**Migrations must keep working with the release that is still serving**,
because they run before the deploy and a rollback does not reverse them. Add
columns and tables before code uses them; remove them in a later release.

### Refresh cadence

`REFRESH_INTERVAL_MINUTES`, a variable on each GitHub environment, is how often
the rates are refreshed: 1440, once a day, unless set. Everything that depends
on it reads that one value:

- the copy, such as "checked once a day";
- the stale badge: a quote older than 1.5 intervals shows as out of date,
  judged by the reader's clock, so a page built yesterday never claims to be
  fresh;
- the admin's late-refresh banner;
- `publish.yml`'s skip gate, which refreshes only once five sixths of an
  interval have passed since the last refresh.

Staging refreshes once a day, which keeps D1 well inside its free daily write
allowance. Production will start at three a day (480, with a schedule tick
every 8 hours and spares). Revisit both at about 1,000 users a month.

### One-time setup

Done by the Cloudflare account's owner. Workers Free is enough.

1. **Create the database.** From the project folder:

   ```bash
   npx wrangler login
   npx wrangler d1 create pakremits-staging --location weur
   ```

   Put the `database_id` it prints into both D1 entries in `wrangler.jsonc`
   and commit it; it is not a secret. A new id also starts a fresh local
   database, so run `npm run db:migrate:local` and `npm run seed` again.

2. **Optionally, a backup bucket.** Cloudflare asks for a payment method before
   it enables R2, even within the free allowance. Without a bucket, D1 Time
   Travel (7 days on the free plan) is the only backup.

   ```bash
   npx wrangler r2 bucket create pakremits-backups
   npx wrangler r2 bucket lifecycle add pakremits-backups expire-backups --expire-days 30
   ```

3. **A Cloudflare API token** for the deploys: **My Profile → API Tokens →
   Create Token**. Start from the *Edit Cloudflare Workers* template and make
   sure it has **Workers Scripts: Edit**, **D1: Edit**, **Workers Routes:
   Edit** on the site's zone (to attach its custom domain) and, for backups,
   **Workers R2 Storage: Edit**, limited to your account. A second, D1-only
   token for the refresh is optional (`CLOUDFLARE_D1_TOKEN`).

4. **The GitHub environment** (**Settings → Environments**): `staging`, with
   deployments limited to `main`. It needs:

   | Kind | Name | Value |
   | --- | --- | --- |
   | Secret | `CLOUDFLARE_API_TOKEN` | The token above |
   | Secret | `CLOUDFLARE_D1_TOKEN` | Optional D1-only token for the refresh |
   | Secret | `RESEND_API_KEY` | Sends the rate alerts and digests the refresh triggers |
   | Variable | `CLOUDFLARE_ACCOUNT_ID` | The account's id |
   | Variable | `SITE_URL` | `https://stage.pakremits.com`, the custom domain in `wrangler.jsonc` |
   | Variable | `REFRESH_INTERVAL_MINUTES` | `1440` |
   | Variable | `TURNSTILE_SITE_KEY` | The public key of a Turnstile widget that lists this site's hostname |
   | Variable | `GTM_ID` | `GTM-N4ZV897G` on staging; unset for none |
   | Variable | `BACKUP_BUCKET` | `pakremits-backups`; unset for no backups |
   | Variable | `ROBOTS_ALLOW_INDEXING` | Unset (false) everywhere but production |
   | Variable | `BHEJO_DISABLED_ADAPTERS` | Optional; see [Adding a provider adapter](#adding-a-provider-adapter) |

   A repository-level secret or variable with one of these names applies to
   every environment that does not set its own, so set `SITE_URL` on each
   environment explicitly.

5. **The address.** The hostname is the custom domain in `wrangler.jsonc`
   (`routes`), which every deploy attaches along with its DNS record and
   certificate. Cloudflare will not take over a hostname that already has a
   DNS record, so delete any record for it before the first publish.

6. **Worker secrets**, once the first publish has created the Worker:

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put GITHUB_DISPATCH_TOKEN
   ```

   `GITHUB_DISPATCH_TOKEN` is for the admin's **Publish now**: a fine-grained
   GitHub token for this repository only, with **Actions: Read and write**.

7. **Recommended:** a branch ruleset on `main` requiring a pull request and the
   `verify` and `migrations` checks, with force pushes blocked. Never add path
   filters to `ci.yml`: a required check that never runs blocks the PR.

### By hand

- **Publish now:** **Actions → Daily → Run workflow**, with `deploy_only` to
  skip the refresh or `force` to refresh even if one ran recently.
- **Roll back the code:** `npx wrangler deployments list`, then
  `npx wrangler rollback <version-id>`; with no id it goes back one version.
  The database stays as it is.
- **Restore the database:** D1 Time Travel restores to any point in the last 7
  days on the free plan, for example
  `npx wrangler d1 time-travel restore pakremits-staging --timestamp 2026-10-06T05:00:00Z`.
  Older states are in the R2 backups, one export a day under
  `<environment>/<date>/`: apply `schema.sql` to an empty database, then
  `data.sql`. Publish afterwards, since the pages are built from the database.

### Staging and production URLs, sitemap, and crawling

`SITE_URL` on each GitHub environment is the site's address. The build bakes
it into canonical links, Open Graph URLs and `/sitemap.xml`, and the deploy
hands it to the Worker for alert email links. To move a site to another
address, change `SITE_URL` and publish.

Staging leaves `ROBOTS_ALLOW_INDEXING` unset, which means false: every response
carries an `X-Robots-Tag: noindex` header (from `out/_headers`) and every page
a robots `noindex` meta tag. `robots.txt` allows crawling on purpose, because a
crawler that is disallowed never fetches the page and so never sees the
noindex; only the sitemap is withheld. At production launch, set
`ROBOTS_ALLOW_INDEXING=true` on the production environment, publish, and verify
`/robots.txt`, `/sitemap.xml`, page canonicals, and alert email links use
`pakremits.com`. Configure a separate production Turnstile widget for the root
domain before switching traffic. The sitemap lists canonical public pages;
alert, admin and API URLs are intentionally excluded. Robots directives guide
cooperative crawlers; they do not password-protect staging.

Public pages load the Google Tag Manager container in `GTM_ID` through Next.js's
`GoogleTagManager` integration, with a `noscript` fallback. Admin and private
alert-management pages do not load GTM, so their URLs and alert tokens are not
sent to the container. Review the tags enabled in GTM and the privacy notice
before publishing new tracking tags.

---

## Launch checklist

| Item | State |
| --- | --- |
| Timestamp on every quote, stale badge past 1.5 refresh intervals | done — asserted in e2e |
| Affiliate disclosure in the footer and beside provider links | done — asserted in e2e |
| Privacy policy covering alert data; deletion on unsubscribe | done — unsubscribe deletes the row |
| Keyboard navigable, visible focus | done — driven with real keys in `test/e2e/accessibility.spec.ts` |
| Colour contrast AA | done — 33 assertions in `test/unit/contrast.test.ts`, Lighthouse a11y 100 |
| `aria-live` on the results panel | done — asserted in e2e |
| Fonts self-hosted via `next/font` | done |
| Unit tests for `computeReceived` and each adapter parser | done — 190 unit tests |
| One Playwright e2e for the home comparison flow | done — 18 specs × 2 form factors |
| Seed script with providers, corridors and 90 days of history | done |
| README a stranger can deploy from | done |
| Lighthouse mobile ≥ 95 | **92** — see below |
| Providers: 14 in the brief | **7 live** — see [Provider access](#provider-access-as-verified-on-19-sep-2026) |

### Accessibility

Lighthouse scores 100 for accessibility on both form factors. Two things were
found and fixed getting there, and both are worth knowing about because a
contrast suite is easy to write dishonestly:

- The first version of `test/unit/contrast.test.ts` listed only pairings that
  passed. Adding the ones it had omitted produced **six failures** — `faint` at
  3.04:1 on white and 2.77:1 on the best-deal row, and the dark-panel greys
  between 3.57 and 4.26. Those tokens came from the design file, which specified
  values that do not meet the bar the brief also asks for. They are now
  `#68716B`, `#99B3A6` and `#B2C6BC`.
- Lighthouse then found a seventh the extended suite still missed: the
  WhatsApp-bubble label at 4.29:1. Also fixed, also now asserted.

The lesson is in the file as a comment: a contrast test that only lists the
pairings you expect to pass proves nothing.

### Performance

Desktop is 100. Mobile is 92, made up of:

| Metric | Value | Lighthouse score |
| --- | --- | --- |
| Total Blocking Time | 30 ms | 100 |
| Cumulative Layout Shift | 0 | 100 |
| Speed Index | 2.0 s | 99 |
| First Contentful Paint | 2.0 s | 85 |
| Largest Contentful Paint | 3.2 s | 73 |

FCP and LCP are the whole gap — there is no blocking-time or layout-shift
problem to fix. Both are critical-path bytes on Lighthouse's simulated slow 4G.

It started at **78**. What moved it to 92 was one thing: Noto Nastaliq Urdu is
233kB, and after compression it was the largest asset on the site — larger than
all the JavaScript combined, and woff2 cannot be squeezed further by a CDN.
English pages were paying all of it to render two fixed phrases: the hero
tagline and the language-switcher label. Those now use a 92kB subset
(`lib/font-data/`, regeneration command in `lib/fonts.ts`), and the full face
loads only on Urdu pages.

Note the subset is deliberately *not* a fallback in the same font stack as the
full face. Webfont fallback is per-character and Nastaliq joins across letters,
so a chain would let one word draw some letters from each and come apart.

What is left, in order of likely value:

1. **44kB of render-blocking CSS.** Inlining the critical part and deferring the
   rest is the standard fix and the most direct lever on FCP. Next does not do
   it out of the box.
2. **A 93kB HTML document** (16kB gzipped), inflated by the inlined RSC payload.
   Trimming the client message catalogue took 4.6kB off it; the rest is the
   panel's initial data, which is what makes the table render without a
   round trip.
3. **231kB of gzipped JS.** Total Blocking Time is already 30 ms, so this costs
   transfer rather than main-thread time. The alert form could be deferred with
   `next/dynamic` since it is below the fold.

Two things measured and rejected, recorded so they are not retried:

- Dropping the `weight` array to use Bricolage's variable font: identical bytes
  and an identical score, because next/font slices by unicode-range either way.
- `preload: false` on Nastaliq: removes the preload hint but not the bytes, since
  the glyphs are genuinely used. Kept for the ordering benefit, but it was not
  the win an earlier measurement appeared to show — that reading came from a
  stale `next start` serving HTML that referenced a CSS chunk which no longer
  existed, so every font had silently fallen back to Times.

### Measuring it yourself

```bash
npm run build && npm run preview
npx lighthouse http://127.0.0.1:8787/ --chrome-flags="--headless=new" --view
```

For the numbers that count, point Lighthouse at the deployed site: Cloudflare's
edge compresses and caches in ways a local server does not.

---

## The admin area

Three pages behind HTTP Basic auth (any username, `ADMIN_PASSWORD` as the
password):

| Page | What it is for |
| --- | --- |
| `/admin` | Clicks by provider and corridor, alert volumes, adapter freshness, cron history |
| `/admin/providers` | Affiliate templates and the sponsored placement |
| `/admin/quotes` | Manual quote overrides |

Edits save to the database straight away but reach the public pages at the
next publish, because the pages are static: the daily run, or **Publish now**
in the admin header, which runs `daily.yml` without a refresh and is live in a
few minutes.

The dashboard's loudest signal is the banner that appears when no refresh has
run for 1.5 refresh intervals (36 hours on staging). It is worth trusting: the
schedule is GitHub's, which is best-effort and does stop, and nothing else on
the site would tell you — a stale quote still renders a number.

### Setting an affiliate template

Paste the network's tracking URL into `/admin/providers` with two placeholders:

- `{clickId}` — becomes the `click_id` of the row written to `affiliate_clicks`,
  which is what lets a conversion the network reports later be traced back to
  the corridor and amount that produced it. **A template without it is rejected**,
  because the click would still work and simply never earn anything.
- `{destination}` — the provider's homepage, URL-encoded.

A provider with no template still links to its homepage. That is the correct
state before a programme is approved, not a broken link, and the dashboard
counts how many clicks it cost you.

### Sponsored placement

One provider at a time can be featured. It is pinned directly below the best
deal, never above, always carries a visible **Sponsored** label, and can never
take the gold **Best deal** highlight. `test/unit/rank.test.ts` fails if
sponsorship ever changes which row is best — the ranking function has no
commission input at all, so this cannot be weakened without a visible code
change.

---

## Adding a provider adapter

1. **Probe the site first.** Open the provider's calculator with devtools on the
   Network tab, filter to XHR, and change the amount. Most of these sites call a
   JSON endpoint you can call directly.
2. `curl` that endpoint. If it fails, add `origin` and `referer` headers for the
   provider's own domain — Remitly returns `{"error_key":"NOT_ALLOWED"}` with
   HTTP 200 without them.
3. Save the response to `test/fixtures/<slug>-gbp-pkr-500.json`.
4. Create `lib/providers/http/<slug>.ts`. Export a pure `parse<Slug>(payload,
   request): Quote` function and an adapter object implementing `ProviderAdapter`.
5. Set `feeModel` correctly. `deducted` means the fee comes out of the amount
   (Wise). `additional` means it is charged on top (Remitly). Getting this wrong
   silently biases the whole table.
6. Fill `supports()` honestly — only the rails the provider actually pays out to.
7. Set `deliverySpeedMinutes` from the provider's published SLA, and leave a
   comment saying it is an SLA rather than live data.
8. Add the adapter to `ALL_ADAPTERS` in `lib/providers/registry.ts`.
9. Add a row to `PROVIDERS` in `scripts/seed.ts` with brand colour and capability flags.
10. Write parser tests in `test/unit/adapters.test.ts` against your fixture:
    the happy path, a malformed payload, and an unsupported delivery method.

Then `npm run probe` to see it live, and `npm run seed` to create its row.

For a provider with no JSON endpoint, set `runtime: 'browser'` and put the
adapter in `lib/providers/browser/`. Those only run in the GitHub Actions
refresh, which sets `BHEJO_ALLOW_BROWSER=1`.

If a provider asks us to stop, add its slug to the `BHEJO_DISABLED_ADAPTERS`
variable on the GitHub environments — it leaves the rotation at the next
refresh, with no code change.

---

## Provider access, as verified on 19 Sep 2026

Every provider in the original brief was checked against two gates: what its
`robots.txt` permits, and whether the quote flow sits behind bot protection.
The result is that **the 14-provider target is not reachable by scraping.**

### Live

| Provider | robots.txt | Bot protection |
| --- | --- | --- |
| **Wise** | Explicitly *allows* it: `Allow: *gateway*sourceCurrency=*` | None |
| **Remitly** | No `robots.txt` on `api.remitly.io` (404 → unrestricted) | None |
| **Careem Pay** | Public anonymous remittance-widget endpoint | None |
| **BOTIM** | Public anonymous remittance calculator endpoint | None |
| **Al Ansari Exchange** | Allow-all policy for its public calculator and WordPress action | None; IPv4 is forced because one advertised IPv6 edge is unreachable |
| **Western Union** | Public send flow and catalog path are allowed | Requires the first-party page session, so Playwright runs only in GitHub Actions |
| **Xoom** | Public consumer page and first-party guest quote endpoint | Requires the first-party page session, so Playwright runs only in GitHub Actions |

Western Union's Qatar route remains catalogue-only: it works interactively but
the localized pricing page times out from GitHub-hosted runners.

### Buildable, not yet written

| Provider | Notes |
| --- | --- |
| Ria | `Allow: /`, no bot protection. The calculator is server-rendered — no quote XHR exists — so this is an HTML parse of an allowed page. Corridor URL still to be pinned down. |
| Small World | `Disallow:` (allow-all), but returns 403 to a plain fetch. Likely geo or UA gating; worth a second look. |
| ACE Money Transfer | robots only excludes `/?utm=` and `/cdn-cgi/`. Also 403 to a plain fetch. |
| Paysend | No `robots.txt` at all. Server-rendered; needs URL discovery. |
| Taptap Send | Its anonymous website feed returns valid Pakistan rates, but the API host returns HTTP 403 for `robots.txt`. It remains catalogue-only because PakRemits refuses automated collection when a provider policy cannot be read. |
| TeleMoney | Pakistan bank and cash services are verified. ANB offers a credentialed exchange-rate API with PKR, but its rate must be checked against the consumer remittance quote before publication. |
| Enjaz Pay | Pakistan bank and cash services are verified. Bank Albilad's production APIs require onboarding, IP allowlisting, and mutual TLS; no anonymous consumer quote is published. |

### Excluded, and why

| Provider | Reason |
| --- | --- |
| **Xe** | `robots.txt` disallows `/currencytransfers/` — which is exactly where the money-transfer quote flow lives. The currency *converter* is allowed, but that is a mid-market rate, not a send quote. |
| **MoneyGram** | Its current policy permits the public corridor, with `Crawl-delay: 5`, but the quote endpoint returns a DataDome CAPTCHA/HTTP 403 to automated sessions. Use the authenticated developer API or provider allowlisting. |
| **WorldRemit** | PerimeterX. GraphQL introspection is disabled and the API requires a bot-detection token. |
| **Lycaremit** | Cloudflare challenge. |

Blocked providers require defeating bot detection, and this project does not do that. The
legitimate routes to those providers are, in order of preference:

1. **Affiliate network data feeds.** Impact and CJ often expose a product/rate
   feed to approved publishers. This is the intended path and needs no scraping.
2. **A partner API.** Wise, Western Union, and MoneyGram all run partner
   programmes with real quote APIs behind a credential.
3. **Manual entry** via `/admin/quotes`, refreshed on whatever cadence is
   practical, clearly marked `source: 'manual'` and timestamped on the page.

Until one of those lands, showing 14 providers is not achievable — the design's
"14 providers checked" line and the `stats` panel should read from the live
count rather than a constant.

Wise's *documented* quote API (`POST /v3/quotes`) is not anonymous either: the
"unauthenticated quote" still needs a client-credentials token from a Wise
Platform partner account. The gateway pricing endpoint above needs nothing, and
Wise's own `robots.txt` invites bots to use it.

### robots.txt is enforced in code

`lib/providers/robots.ts` gates every outbound adapter request. It is not
advisory — a disallowed path throws, the adapter fails, and `refresh()` degrades
that row to a stale badge. `test/unit/robots.test.ts` runs against the real
files captured from each provider, so the exclusions above are asserted rather
than merely documented.

Adapters against a documented partner API can pass `skipRobots: true` to
`fetchJson`, since a signed contract governs access instead of a crawl policy.

Tier B and C endpoints are unofficial and unversioned. The fixture tests in
`test/unit/adapters.test.ts` are the early-warning system: when one starts
failing, run `npm run probe -- --save` and read the diff before touching the
parser.

### Two corridor-level quirks worth knowing

- **Remitly outside the UK.** UK responses include a `pay_out_price_estimates`
  breakdown per rail. USD, AED, and EUR return a single estimate with an empty
  `pay_out_method` and no breakdown — and passing an explicit `pay_out_method`
  parameter is ignored. The adapter accepts that corridor-level rate for any
  rail `supports()` allows, since the rate genuinely is identical and only the
  delivery speed differs.
- **Wise pays out to bank accounts only** for PKR. No wallet, cash, or RDA rails.

---

## Mid-market rates

Wise's public rate endpoints, no key:

- `wise.com/rates/live?source=GBP&target=PKR`
- `wise.com/rates/history+live?source=GBP&target=PKR&length=30&resolution=daily&unit=day`

The obvious alternatives do not work for this corridor:

- **Frankfurter** is ECB-only and the ECB does not publish PKR, so it has no PKR
  at any endpoint.
- **exchangerate.host** now requires a key, caps the free tier at 100
  requests/month, and does not serve HTTPS there.

`open.er-api.com` sits behind the same `FxSource` interface as a fallback. It
needs no key but updates only daily and has no history route — if it is ever the
active source, its attribution link is required in the footer.

---

## Affiliate programmes

Ranking never depends on commission. `lib/ranking/rank.ts` has no parameter for
it, deliberately, so it cannot be added by accident. A `featured` provider is
pinned *below* the best deal with a "Sponsored" label and never above it, which
the ranking tests assert.

| Provider | Network | How to apply |
| --- | --- | --- |
| Wise | Impact | [impact.com](https://impact.com) → search "Wise" → apply to the Wise Affiliate Program |
| Remitly | Impact | Same, "Remitly". Bounty per first completed transfer. |
| WorldRemit | Impact | Same, "WorldRemit". |
| Xe | CJ Affiliate | [cj.com](https://www.cj.com) publisher account → advertiser search "Xe" |
| ACE Money Transfer | Direct | Email their partnerships team; no network involved |
| Sadapay / Nayapay | None | No programme. Listed for completeness, never monetised. |

Once approved, paste the tracking template into `providers.affiliate_url_template`
with a `{clickId}` placeholder. `/go/[provider]` (Phase 4) logs the click and
substitutes it before the 302.

Note that `npm run seed` deliberately does **not** overwrite
`affiliate_url_template` or `featured` on re-run, so production values survive a
reseed.

---

## Architecture notes

```
lib/
  providers/
    types.ts        ProviderAdapter contract, fetchJson with timeouts
    registry.ts     adapter list, runtime filter, BHEJO_DISABLED_ADAPTERS
    refresh.ts      the loop; stale fallback; nothing throws past here
    http/           tier A + B adapters — plain fetch, run anywhere
    browser/        tier C adapters — Playwright, GitHub Actions only
  ranking/
    compute.ts      computeReceived and friends. Pure, no I/O.
    rank.ts         sort order and sponsored placement. No commission input.
  fx/               mid-market sources behind one interface
  db/               Drizzle schema (SQLite) and the D1 binding the Worker,
                    scripts and build share
  corridors.ts      the eight corridors as static config
worker/             /go, /api, /alerts and /admin: the only code that runs
                    per request
```

Two rules hold the thing together:

**Nothing throws past `refresh.ts`.** A provider changing its JSON shape at 3am
degrades to a stale badge on one row, not an empty comparison table. Each slot
falls back to the last known good quote, re-written with `stale: true`.

**Every row answers the same question.** `canonicalReceived` always computes in
the `deducted` model — "I have £500 to spend in total, what lands?" — regardless
of how the provider frames its own fee. Comparing a fee-on-top provider at face
value against a fee-deducted one silently favours the former.

---

## Roadmap

- **Phase 2** — the public site: home page from the design file, 8 corridor
  pages, provider and comparison pages, rate pages, Urdu locale with RTL.
- **Phase 3** — rate alerts: double opt-in email, WhatsApp via Twilio,
  once-per-12-hours rate limiting, one-click unsubscribe.
- **Phase 4** — affiliate redirects with click tracking, `/admin` dashboard.
- **Phase 5** — trust and launch: stale badges, accessibility pass, Playwright
  e2e, Lighthouse.

---

## Alert form bot protection and email

The alert signup uses Cloudflare Turnstile in Managed mode. Create a widget for
the site's hostname, set its site key as the `TURNSTILE_SITE_KEY` variable on the
GitHub environment (the build puts it in the pages), and its secret as the Worker
secret `TURNSTILE_SECRET_KEY`. Both are required in production; signup fails
closed if verification is missing or invalid. For local development,
Cloudflare's official test keys are used automatically when these variables are
unset. Use a separate real widget for staging and production.

Confirmation, rate alert, and weekly digest emails share a branded HTML template
and include matching plain-text content. The Worker sends confirmations and the
refresh sends alerts and digests, so `RESEND_API_KEY` is both a Worker secret
and a GitHub environment secret; `RESEND_FROM` is set in `wrangler.jsonc` and
`publish.yml`. Verify the sender domain's SPF, DKIM, and DMARC records with your
email provider. Rate alerts and digests include one-click unsubscribe headers.
These practices support deliverability, but inbox placement cannot be
guaranteed.
