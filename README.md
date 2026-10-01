# PakRemits

Compares money-transfer services sending to Pakistan, ranked by the exact PKR
amount that lands in the recipient's account. Not by rate, not by fee, not by
who pays us.

**Status: Phases 1–5 complete, with one number short of target.** The rate engine runs against live provider
APIs and the full public site renders from it — home, 8 corridor pages, 8 rate
pages, provider and head-to-head pages, method pages, and the static set, in
English and Urdu. 26 pages prerender.

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
- Cron refresh endpoint plus a GitHub Actions schedule.
- Password-protected manual quote override at `/admin/quotes`.
- Rate alerts: double opt-in email, WhatsApp/SMS behind a swappable notifier,
  12-hour rate limiting, weekly digest, one-click unsubscribe that deletes.
- `/admin` dashboard: clicks by provider and corridor, alert volumes, adapter
  freshness, cron run history, and affiliate template management.

### Alerts without a Resend or Twilio account

`lib/notify/` falls back to a console notifier whenever credentials are absent,
so the entire pipeline — evaluation, rate limiting, message composition, trigger
recording — runs locally and prints the messages it would have sent. Sends are
marked `simulated`, and a trigger is still recorded, otherwise a local run would
re-fire the same alert every 15 minutes.

**Alerts trigger on the best rate actually obtainable, not the mid-market rate.**
Nobody can get the mid-market rate, so an alert firing when it crosses 380 would
tell the recipient to act on a number they cannot have — and the message would
then have to read "crossed 380, best available 378.90". If no provider quote
exists for a corridor we do not fall back to mid-market; we simply do not fire.

---

## Local setup

Requires Node 20+ (or 22+; Node 23 works but emits engine warnings from eslint).

```bash
git clone <your-repo> pakremits && cd pakremits
npm install
cp .env.example .env.local
```

### Supabase

The complete schema, migration, seed, and refresh instructions are also
available in [README-DB.md](./README-DB.md).

1. Create a project at [supabase.com](https://supabase.com) — the free tier is enough.
2. **Project Settings → Database → Connection string**. Copy two URLs into `.env.local`:
   - `DATABASE_URL` — the **Transaction** pooler URL (port `6543`). Used at runtime.
   - `DIRECT_URL` — the **Session** URL (port `5432`). Used only for migrations,
     because the pooler cannot run DDL transactions reliably.
3. Apply the schema and the RLS policies:

```bash
npm run db:migrate
```

`0001_rls.sql` enables row-level security with no policies, which closes
Supabase's auto-generated REST API. Without it, the `rate_alerts` table — email
addresses and phone numbers — would be readable by anyone with the anon key.

### Seed and first refresh

```bash
npm run seed      # providers, corridors, 30 days of mid-market history
npm run refresh   # walks the full grid and writes live quotes
```

SadaPay, NayaPay, and Roshan Digital Account remain separate account choices in
the comparison selector. They display the existing `bank` quote and benchmark
rows, not separate account-specific prices. The UI labels these as general PKR
bank-deposit quotes and asks users to confirm account eligibility with the
provider. Legacy `neobank` and `rda` quote requests also resolve to the `bank`
rail; no new quote-collection jobs or database migration are needed.

The seed pulls real 30-day history from Wise. If that call fails it writes a
deterministic synthetic walk marked `source: 'synthetic'`, so the charts render
on a fresh deploy and the fake data is trivially identifiable.

### Run it

```bash
npm run dev
```

- `/admin/quotes` — HTTP Basic auth, any username, `ADMIN_PASSWORD` as password.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (compute, ranking, adapter parsers) |
| `npm run typecheck` | `next typegen && tsc --noEmit`: route types first, as on a fresh checkout |
| `npm run probe` | Call every adapter live and print a comparison table |
| `npm run probe -- --from AED --amount 3000 --method wallet` | Probe one corridor |
| `npm run probe -- --save` | Re-capture test fixtures from live responses |
| `npm run refresh` | Full refresh locally, bypassing the HTTP route |
| `npm run seed` | Idempotent seed |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run e2e` | Playwright end-to-end suite (needs a seeded database) |
| `npm run e2e:ui` | The same, in Playwright's UI mode |

### URLs

Public URLs do not match the file router, for two reasons documented in
`next.config.ts`: Next dynamic segments must be a whole path segment (so
`compare/[slug]-to-pakistan` is not expressible as a folder), and
English is served unprefixed while pages live under `/[locale]`. Both are
handled by explicit rewrites.

**Never link an internal path directly.** `robots.txt` disallows `/corridor/`,
`/rate/` and `/method/`, so a stray internal link would point search engines at
a de-indexed URL. Every link goes through `lib/routes.ts`, which takes a locale
so Urdu pages link to Urdu pages. Adding a page means adding a rewrite line.

---

## Deploying to Fly.io

The `Dockerfile` and both Fly configs are committed. `fly.staging.toml` is the
staging app, `pakremits-staging` at https://stage.pakremits.com; `fly.toml`
describes a production app, `pakremits`, that has not been created on Fly yet.
The image compiles with `next build --experimental-build-mode compile`, which
needs no database, and `docker-entrypoint.mjs` prerenders the pages when the
container boots, once Fly has injected `DATABASE_URL`.

Server-only values are Fly secrets: `DATABASE_URL`, `CRON_SECRET` and
`ADMIN_PASSWORD`, plus whichever notification secrets from `.env.example` you use.

```bash
fly secrets set -a pakremits-staging DATABASE_URL="postgresql://..." CRON_SECRET="..." ADMIN_PASSWORD="..."
```

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so they go in the
config's `[build.args]` as well as `[env]`, never in secrets. Do not commit
secrets to either TOML file.

The HTTP health check deliberately uses `/`, not `/api/health`: the server only
starts listening once the boot-time prerender has finished, so a passing `/`
means the release can serve pages. Keep one Machine, because Next's filesystem
cache and tag invalidation are local to each Machine.

After the first deploy of a new app, set the GitHub Actions repository variable
`SITE_URL` to its public address. The scheduled refresh updates PostgreSQL
directly and then asks that address to revalidate its cached quote pages.

### Continuous deployment

`.github/workflows/ci.yml` runs on every pull request into `main` and every push
to `main`:

| Job | Runs on | What it does |
| --- | --- | --- |
| `verify` | PRs and pushes | Typecheck, lint, unit tests, and the same compile-mode build the image runs |
| `migrations` | PRs and pushes | Applies every migration to an empty Postgres, then checks a second run applies nothing |
| `deploy-staging` | Pushes to `main` that pass both | Deploys `pakremits-staging`, smoke-tests it, and rolls back if that fails |

These are the only type and lint gates before a deploy: the compile-mode build
skips type checking, and Next 16's build no longer runs ESLint.

The deploy job:

1. **Deploys only the tip of `main`.** Deploys queue one at a time, and a run
   whose commit is no longer the tip skips, so a slow or re-run job never
   downgrades staging.
2. **Migrates first.** Fly runs `node scripts/migrate.mjs` as the release
   command, in a one-off Machine with the app's own secrets, before any Machine
   is replaced. Pending migrations apply in one transaction; a failure stops the
   deploy with the old release still serving.
3. **Switches blue-green.** The new Machine boots beside the old one and only
   takes traffic once its health check passes, so the boot-time prerender is not
   downtime, and a release that fails to boot never serves.
4. **Smoke-tests the result.** It waits for `/api/health` to report the new
   commit (the image carries it as `GIT_SHA`), checks the main pages return 200,
   and checks staging still refuses indexing. It sends GET requests only and
   never touches `/go/*` or `/api/quotes`, which record the clicks and
   comparisons behind the public proof figures.
5. **Rolls back** to the image that was serving if the smoke test fails. The job
   still fails, so someone looks.

**Migrations must keep working with the release that is still serving**,
because they run before the switch and a rollback does not reverse them. Add
columns and tables before code uses them; remove them in a later release. Do not
run `npm run db:migrate` by hand during a deploy: the migrator takes no lock.

#### One-time setup

The deploy uses an app-scoped Fly token that only `main` can read:

1. Create it with
   `fly tokens create deploy -a pakremits-staging -n "GitHub Actions staging deploy" -x 8760h`
   and copy the whole output, including the `FlyV1 ` prefix.
2. On GitHub, as the repository owner: **Settings → Environments → New
   environment** `staging`. Under deployment branches choose *Selected branches*
   and add `main`, then add the environment secret `FLY_DEPLOY_TOKEN`. The
   repository secret `FLY_API_TOKEN` is the refresh workflow's database tunnel
   and cannot deploy; leave it alone.
3. Recommended: a branch ruleset on `main` requiring a pull request and the
   `verify` and `migrations` checks, with force pushes blocked. Never add path
   filters to `ci.yml`: a required check that never runs blocks the PR.

The token expires after a year. Replace the secret, then remove the old token
with `fly tokens list -a pakremits-staging` and `fly tokens revoke <id>`.

#### Deploying or rolling back by hand

```bash
fly deploy -c fly.staging.toml --build-arg GIT_SHA=$(git rev-parse HEAD)
fly releases -a pakremits-staging --image
fly deploy -c fly.staging.toml --image <image ref> --skip-release-command
```

Pass `--skip-release-command` when redeploying an older image: its migrations
are already applied, and images built before the pipeline have no
`scripts/migrate.mjs`.

### Staging and production URLs, sitemap, and crawling

`fly.staging.toml` sets `NEXT_PUBLIC_SITE_URL=https://stage.pakremits.com`
both at build time and at runtime. Canonical links, Open Graph URLs, alert
confirmation links, redirects, and `/sitemap.xml` all use that value. For the
production Fly app, set it to `https://pakremits.com` in **both** `[build.args]`
and `[env]`, then redeploy; `NEXT_PUBLIC_*` values are compiled into the site.
Also change the GitHub Actions repository variable `SITE_URL` to the production
URL when the scheduled job should revalidate production pages.

Staging sets `ROBOTS_ALLOW_INDEXING=false` at build and runtime. Its
`/robots.txt` says
`User-agent: *` and `Disallow: /`, and pages emit `noindex`. The sitemap remains
available for inspection but is not advertised in staging robots.txt. At
production launch, set `ROBOTS_ALLOW_INDEXING=true` in **both** `[build.args]`
and `[env]` on the production app, redeploy, and verify `/robots.txt`,
`/sitemap.xml`, page canonicals, and alert email links use `pakremits.com`.
Configure a separate production
Turnstile widget for the root domain before switching traffic. The sitemap
lists canonical public pages; private alert/admin/API URLs and internal rewrite
targets are intentionally excluded. Robots directives guide cooperative
crawlers; they do not password-protect staging.

Public pages load the Google Tag Manager container configured by
`NEXT_PUBLIC_GTM_ID` using Next.js's `GoogleTagManager` integration, with a
`noscript` fallback. The staging config uses `GTM-N4ZV897G`. Set the same
variable in both build args and runtime env for the production Fly app and
redeploy. Admin and private alert-management pages do not load GTM, so their
URLs and alert tokens are not sent to the container. Review the tags enabled in
GTM and the privacy notice before publishing new tracking tags.

## Deploying to Vercel

1. Push to GitHub, import the repo at [vercel.com/new](https://vercel.com/new).
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
3. Deploy.

### The cron is not on Vercel

Vercel's Hobby plan **caps cron jobs at once per day** and rejects any more
frequent expression at deploy time
([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). A 15-minute
refresh therefore runs from GitHub Actions, which provides Chromium for the
Western Union browser adapter.

The job also does not call the site over HTTP. A full refresh across the grid
takes about four minutes with polite per-host throttling, well past the 60s
function limit, so `.github/workflows/refresh-rates.yml` runs `npm run refresh`
directly against the database and then pings `/api/cron/revalidate` to drop the
cached pages. It first runs `npm run providers:sync`, so newly collected
providers exist in the database before quotes are written.
`/api/cron/refresh-rates` still exists for manual triggering.

In your GitHub repo:

- **Settings → Secrets and variables → Actions → Secrets**: add `DATABASE_URL`
  (the pooled Supabase URL) and `CRON_SECRET`, matching the value on the deployed app.
- **→ Variables**: add `SITE_URL`, e.g. `https://pakremits.fly.dev`. Leave it
  unset before the first deploy and the revalidate step skips itself.

Trigger the workflow by hand from the Actions tab to check it before waiting for
a tick. It runs at 7, 22, 37, and 52 minutes past each hour (UTC), avoiding the
top-of-hour load peak. GitHub's scheduler is best-effort and can still lag,
which is why `/admin` surfaces the last successful run.

---

## Launch checklist

| Item | State |
| --- | --- |
| Timestamp on every quote, stale badge past 60 minutes | done — asserted in e2e |
| Affiliate disclosure in the footer and beside provider links | done — asserted in e2e |
| Privacy policy covering alert data; deletion on unsubscribe | done — unsubscribe deletes the row |
| Keyboard navigable, visible focus | done — driven with real keys in `test/e2e/accessibility.spec.ts` |
| Colour contrast AA | done — 33 assertions in `test/unit/contrast.test.ts`, Lighthouse a11y 100 |
| `aria-live` on the results panel | done — asserted in e2e |
| Fonts self-hosted via `next/font` | done |
| Unit tests for `computeReceived` and each adapter parser | done — 190 unit tests |
| One Playwright e2e for the home comparison flow | done — 18 specs × 2 form factors |
| Seed script with providers, corridors and 30 days of history | done |
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
npm run build && npm start
npx lighthouse http://localhost:3000/ --chrome-flags="--headless=new" --view
```

`next start` gzips both HTML and static assets, so a local number is comparable
to a deployed one. Vercel adds brotli, worth a few percent more.

---

## The admin area

Three pages behind HTTP Basic auth (any username, `ADMIN_PASSWORD` as the
password):

| Page | What it is for |
| --- | --- |
| `/admin` | Clicks by provider and corridor, alert volumes, adapter freshness, cron history |
| `/admin/providers` | Affiliate templates and the sponsored placement |
| `/admin/quotes` | Manual quote overrides |

The dashboard's loudest signal is the banner that appears when no refresh has
run in 45 minutes. It is worth trusting: the schedule is GitHub's, which is
best-effort and does stop, and nothing else on the site would tell you — a
stale quote still renders a number.

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
adapter in `lib/providers/browser/`. Those are skipped on Vercel and only run in
the GitHub Actions job, which sets `BHEJO_ALLOW_BROWSER=1`.

If a provider asks us to stop, add its slug to `BHEJO_DISABLED_ADAPTERS` — it
leaves the rotation immediately with no deploy.

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
  db/               Drizzle schema and a lazily-connected client
  corridors.ts      the eight corridors as static config
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
the site's hostname, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` at build and runtime, and keep
`TURNSTILE_SECRET_KEY` as a server-side secret. Both are required in production;
signup fails closed if verification is missing or invalid. For local development,
Cloudflare's official test keys are used automatically when these variables are
unset. Use a separate real widget for staging and production.

Confirmation, rate alert, and weekly digest emails share a branded HTML template
and include matching plain-text content. Set `RESEND_API_KEY`, `RESEND_FROM`, and
`NEXT_PUBLIC_SITE_URL`; verify the sender domain's SPF, DKIM, and DMARC records
with your email provider. Rate alerts and digests include one-click unsubscribe
headers. These practices support deliverability, but inbox placement cannot be
guaranteed.

---

## Local Postgres without Supabase

For development you can skip Supabase entirely:

```bash
docker run -d --name pakremits-pg -e POSTGRES_PASSWORD=pakremits -e POSTGRES_DB=pakremits \
  -p 55432:5432 postgres:16-alpine
```

Then set both URLs in `.env.local` to
`postgresql://postgres:pakremits@localhost:55432/pakremits` and run `npm run db:migrate`,
`npm run seed`, `npm run refresh`. The RLS migration is guarded on role
existence, so it applies cleanly against a plain Postgres that has no `anon` or
`authenticated` roles.
