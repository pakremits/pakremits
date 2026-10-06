/**
 * PakRemits database schema (Cloudflare D1, which is SQLite).
 *
 * Money notes:
 *  - Amounts and rates are REAL. Every writer rounds on the way in with
 *    `toMoney` (2 dp) or `toRate` (6 dp) from lib/db, as numeric(14,2) and
 *    numeric(18,6) did when this was Postgres. A double holds 2 dp exactly
 *    enough for amounts up to ~10^13 PKR and 6 dp for any PKR rate, and every
 *    figure is re-rounded by lib/ranking/compute.ts before it is shown.
 *  - Timestamps are epoch milliseconds in INTEGER columns; drizzle maps them to
 *    Date. Day buckets use `date(x / 1000, 'unixepoch')`, which is UTC.
 *  - Booleans are 0/1 INTEGERs, mapped to boolean by drizzle.
 *  - IDs are INTEGER PRIMARY KEY (the rowid), without AUTOINCREMENT, which only
 *    adds a write to a bookkeeping table on every insert.
 *
 * D1 bills rows read and rows written, and every index adds a written row per
 * insert, so each index below is one a query actually uses.
 */
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/** Currencies we accept as the sending side. Target is always PKR. */
export const SEND_CURRENCIES = [
  'GBP',
  'AED',
  'SAR',
  'USD',
  'CAD',
  'AUD',
  'QAR',
  'EUR',
] as const
export type SendCurrency = (typeof SEND_CURRENCIES)[number]

/**
 * How the recipient in Pakistan actually gets the money. These are the values
 * behind the "Recipient gets it in" select on the home page.
 */
export const DELIVERY_METHODS = [
  'bank', // Bank account deposit (HBL, Meezan, ...)
  'wallet', // JazzCash / Easypaisa
  'neobank', // Sadapay / Nayapay
  'cash', // Cash pickup at an agent
  'rda', // Roshan Digital Account
] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

/** Where a quote came from. Drives the provenance badge in /admin. */
export const QUOTE_SOURCES = ['api', 'scrape', 'manual'] as const
export type QuoteSource = (typeof QUOTE_SOURCES)[number]

/**
 * The current time in epoch milliseconds, as a column default. julianday()
 * rather than unixepoch('subsec'), which needs SQLite 3.42.
 */
const NOW_MS = sql`(cast((julianday('now') - 2440587.5) * 86400000 as integer))`

/** An epoch-milliseconds column that reads and writes as a Date. */
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })

/** A 0/1 column that reads and writes as a boolean. */
const flag = (name: string) => integer(name, { mode: 'boolean' })

export const providers = sqliteTable('providers', {
  id: integer('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  /** Hex colour for the square provider mark in the results table. */
  brandColor: text('brand_color').notNull().default('#8A8F8C'),
  /** Foreground colour for the mark, when the brand colour needs a light glyph. */
  brandTextColor: text('brand_text_color').notNull().default('#FFFFFF'),
  homepageUrl: text('homepage_url').notNull(),
  /**
   * Affiliate destination with `{clickId}` substituted at redirect time, e.g.
   * `https://wise.prf.hn/click/camref:1011l123/destination:{destination}?subid={clickId}`
   * Null means we link to the homepage with no commission.
   */
  affiliateUrlTemplate: text('affiliate_url_template'),
  affiliateNetwork: text('affiliate_network', {
    enum: ['impact', 'cj', 'partnerize', 'direct', 'none'],
  })
    .notNull()
    .default('none'),
  commissionNote: text('commission_note'),

  supportsBank: flag('supports_bank').notNull().default(false),
  supportsWallet: flag('supports_wallet').notNull().default(false),
  supportsNeobank: flag('supports_neobank').notNull().default(false),
  supportsCash: flag('supports_cash').notNull().default(false),
  supportsRda: flag('supports_rda').notNull().default(false),

  /**
   * Pins the row directly *below* the best deal with a "Sponsored" label.
   * Never above. See /how-we-rank — this is a load-bearing promise.
   */
  featured: flag('featured').notNull().default(false),
  /**
   * Synthetic reference row ("Bank Transfer") used for the
   * "₨ X more than your bank" line. Excluded from the affiliate CTA.
   */
  isBenchmark: flag('is_benchmark').notNull().default(false),
  active: flag('active').notNull().default(true),
})

export const corridors = sqliteTable(
  'corridors',
  {
    id: integer('id').primaryKey(),
    /** URL segment, e.g. `uk` → /compare/uk-to-pakistan */
    slug: text('slug').notNull().unique(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    /** ISO 3166-1 alpha-2, e.g. GB. Providers key their APIs off country, not currency. */
    fromCountry: text('from_country').notNull(),
    /** Display name used in copy: "United Kingdom". */
    fromCountryName: text('from_country_name').notNull(),
    toCurrency: text('to_currency').notNull().default('PKR'),
    /** Symbol for the amount input prefix: £, $, SAR ... Seeded for reference;
     *  every render reads CURRENCY_SYMBOLS so the two cannot disagree on screen. */
    currencySymbol: text('currency_symbol').notNull(),
    active: flag('active').notNull().default(true),
  },
  (t) => [uniqueIndex('corridors_from_currency_idx').on(t.fromCurrency)],
)

/**
 * Every capture, kept for 45 days: the /admin quote history and adapter
 * health read it. Pages never do — they read `latest_quotes`.
 */
export const rateQuotes = sqliteTable(
  'rate_quotes',
  {
    id: integer('id').primaryKey(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    corridorId: integer('corridor_id')
      .notNull()
      .references(() => corridors.id, { onDelete: 'cascade' }),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }).notNull(),

    amountSent: real('amount_sent').notNull(),
    /** Provider's exchange rate, including any markup they apply. */
    rate: real('rate').notNull(),
    fee: real('fee').notNull(),
    /** Denormalised so ranking never recomputes; always == computeReceived(...). */
    amountReceived: real('amount_received').notNull(),

    deliverySpeedText: text('delivery_speed_text').notNull(),
    /** Rough minutes-to-arrive, for the "Fastest" sort. Null when unknown. */
    deliverySpeedMinutes: integer('delivery_speed_minutes'),

    promoFlag: flag('promo_flag').notNull().default(false),
    promoNote: text('promo_note'),

    capturedAt: timestamp('captured_at').notNull().default(NOW_MS),
    source: text('source', { enum: QUOTE_SOURCES }).notNull(),
    /**
     * True when the adapter failed and we served the previous value. Surfaces as
     * the "stale" badge and feeds the stale-adapter list in /admin.
     */
    stale: flag('stale').notNull().default(false),
  },
  // Pruning, the admin history and adapter health all range over capture time.
  (t) => [index('rate_quotes_captured_idx').on(t.capturedAt)],
)

/**
 * The newest quote per provider, corridor, method and amount: what the site
 * shows. Written together with its `rate_quotes` row in one batch
 * (lib/quotes-write.ts), so the two never disagree.
 *
 * It exists because D1 bills rows read: "newest per provider" over the
 * history table scans weeks of rows to keep a handful, while this table is
 * one row per slot, read by its primary key.
 */
export const latestQuotes = sqliteTable(
  'latest_quotes',
  {
    corridorId: integer('corridor_id')
      .notNull()
      .references(() => corridors.id, { onDelete: 'cascade' }),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }).notNull(),
    amountSent: real('amount_sent').notNull(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),

    rate: real('rate').notNull(),
    fee: real('fee').notNull(),
    amountReceived: real('amount_received').notNull(),
    deliverySpeedText: text('delivery_speed_text').notNull(),
    deliverySpeedMinutes: integer('delivery_speed_minutes'),
    promoFlag: flag('promo_flag').notNull().default(false),
    promoNote: text('promo_note'),
    source: text('source', { enum: QUOTE_SOURCES }).notNull(),

    /** True while an adapter is failing and this row re-serves its last good quote. */
    stale: flag('stale').notNull().default(false),
    /** When this row was last written: the capture, or the stale re-serve. */
    capturedAt: timestamp('captured_at').notNull(),
    /** When these figures were actually captured. Drives the stale cap. */
    lastGoodAt: timestamp('last_good_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.corridorId, t.deliveryMethod, t.amountSent, t.providerId] }),
  ],
)

export const midMarketRates = sqliteTable(
  'mid_market_rates',
  {
    id: integer('id').primaryKey(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    toCurrency: text('to_currency').notNull().default('PKR'),
    rate: real('rate').notNull(),
    capturedAt: timestamp('captured_at').notNull().default(NOW_MS),
    source: text('source').notNull(),
  },
  (t) => [index('mid_market_lookup_idx').on(t.fromCurrency, t.capturedAt)],
)

export const rateAlerts = sqliteTable(
  'rate_alerts',
  {
    id: integer('id').primaryKey(),
    /** Email address or E.164 phone number, depending on `channel`. */
    userContact: text('user_contact').notNull(),
    channel: text('channel', { enum: ['email', 'whatsapp', 'sms'] }).notNull(),
    fromCurrency: text('from_currency', { enum: SEND_CURRENCIES }).notNull(),
    targetRate: real('target_rate').notNull(),
    direction: text('direction', { enum: ['above', 'below'] }).notNull(),

    /** Email alerts stay inactive until the double opt-in link is clicked. */
    confirmed: flag('confirmed').notNull().default(false),
    active: flag('active').notNull().default(true),
    wantsDigest: flag('wants_digest').notNull().default(false),

    createdAt: timestamp('created_at').notNull().default(NOW_MS),
    /** Enforces the once-per-12-hours rule promised on the form. */
    lastTriggeredAt: timestamp('last_triggered_at'),
    /** Separate clock from lastTriggeredAt — a digest is not a trigger, and
     *  receiving one must not suppress a real threshold crossing. */
    lastDigestAt: timestamp('last_digest_at'),
    /** Set when the double opt-in link is used. Kept alongside `confirmed`
     *  because "when did they consent" is the question a regulator asks. */
    confirmedAt: timestamp('confirmed_at'),
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
  },
  // Sign-up looks up a contact's existing alerts (duplicates, the cap, the
  // unconfirmed sign-up limit).
  (t) => [index('rate_alerts_contact_idx').on(t.userContact, t.createdAt)],
)

export const affiliateClicks = sqliteTable(
  'affiliate_clicks',
  {
    id: integer('id').primaryKey(),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    corridorId: integer('corridor_id').references(() => corridors.id, {
      onDelete: 'set null',
    }),
    amountSent: real('amount_sent'),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }),
    /** Our generated id, substituted into `{clickId}` for network attribution. */
    clickId: text('click_id').notNull().unique(),
    referrer: text('referrer'),
    utm: text('utm'),
    createdAt: timestamp('created_at').notNull().default(NOW_MS),
  },
  (t) => [index('affiliate_clicks_created_idx').on(t.createdAt)],
)

/**
 * One row per refresh run. Read by /admin to show "last cron run" and to
 * detect a silently dead GitHub Actions schedule.
 */
export const cronRuns = sqliteTable('cron_runs', {
  id: integer('id').primaryKey(),
  job: text('job').notNull(),
  startedAt: timestamp('started_at').notNull().default(NOW_MS),
  finishedAt: timestamp('finished_at'),
  quotesWritten: integer('quotes_written').notNull().default(0),
  adaptersOk: integer('adapters_ok').notNull().default(0),
  adaptersFailed: integer('adapters_failed').notNull().default(0),
  error: text('error'),
})

export type Provider = typeof providers.$inferSelect
export type Corridor = typeof corridors.$inferSelect
export type RateQuote = typeof rateQuotes.$inferSelect
export type LatestQuote = typeof latestQuotes.$inferSelect
export type MidMarketRate = typeof midMarketRates.$inferSelect
export type RateAlert = typeof rateAlerts.$inferSelect

/* ────────────────────────────────────────────────────────────────────────────
 * Proof layer
 *
 * Every trust claim on the site is computed from these tables. Nothing here is
 * ever estimated, backfilled or rounded up: a number we cannot derive from a
 * row is not shown at all. See lib/proof/ and /how-we-rank#savings.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Bank transfer benchmark pricing per corridor and rail.
 *
 * Previously a hard-coded constant in lib/quotes.ts. It moves into the database
 * because the savings figure is only defensible if the benchmark it is measured
 * against has a visible provenance and an update date — both of which are shown
 * on /how-we-rank#savings.
 */
export const bankBenchmarks = sqliteTable(
  'bank_benchmarks',
  {
    id: integer('id').primaryKey(),
    corridorId: integer('corridor_id')
      .notNull()
      .references(() => corridors.id, { onDelete: 'cascade' }),
    deliveryMethod: text('delivery_method', { enum: DELIVERY_METHODS }).notNull(),
    rate: real('rate').notNull(),
    fee: real('fee').notNull(),
    /** Where the figure came from, shown verbatim in the methodology table. */
    note: text('note'),
    /**
     * Set when a human enters a real quote in /admin. The weekly cron refresh
     * skips pinned rows — otherwise it would silently overwrite the one figure
     * somebody actually verified with a generated approximation.
     */
    pinned: flag('pinned').notNull().default(false),
    updatedAt: timestamp('updated_at').notNull().default(NOW_MS),
  },
  (t) => [uniqueIndex('bank_benchmarks_slot_idx').on(t.corridorId, t.deliveryMethod)],
)

/**
 * One row per affiliate click, recording what the user avoided paying.
 *
 * `savingPkr` is null when no benchmark existed for the corridor at click time.
 * Those rows are kept — the click still happened — but excluded from every
 * total, which is why the sums in lib/proof/stats.ts all filter on NOT NULL.
 */
export const savingsLedger = sqliteTable(
  'savings_ledger',
  {
    id: integer('id').primaryKey(),
    /** FK to the click that produced it. Unique: one ledger row per click. */
    affiliateClickId: integer('affiliate_click_id')
      .notNull()
      .references(() => affiliateClicks.id, { onDelete: 'cascade' })
      .unique(),
    corridorId: integer('corridor_id').references(() => corridors.id, {
      onDelete: 'set null',
    }),
    providerId: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    amountSent: real('amount_sent').notNull(),
    providerReceivedPkr: real('provider_received_pkr').notNull(),
    /** Null together with `savingPkr` when the corridor had no benchmark. */
    bankReceivedPkr: real('bank_received_pkr'),
    savingPkr: real('saving_pkr'),
    createdAt: timestamp('created_at').notNull().default(NOW_MS),
  },
  (t) => [index('savings_ledger_created_idx').on(t.createdAt)],
)

/**
 * Pre-aggregated daily counters for the admin chart.
 *
 * A rollup rather than a live GROUP BY because the ledger and event tables grow
 * by thousands of rows a day and the dashboard reads them on every load.
 * Rebuilt idempotently by `rollUpSiteStats` at the end of each cron run.
 */
export const siteStatsDaily = sqliteTable('site_stats_daily', {
  /** Calendar day in UTC, `YYYY-MM-DD`. Primary key: exactly one row per day. */
  date: text('date').primaryKey(),
  comparisonsRun: integer('comparisons_run').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  savingPkrTotal: real('saving_pkr_total').notNull().default(0),
  bestProviderChanges: integer('best_provider_changes').notNull().default(0),
})

/**
 * Raw comparison-widget hits, deduplicated to one per session per minute.
 *
 * The dedup is a unique index on (session, minute) plus ON CONFLICT DO NOTHING,
 * rather than a read-then-write: two concurrent requests from one session would
 * both pass a read check and double-count. Rolled into `site_stats_daily` and
 * pruned, so this table stays small.
 */
export const comparisonEvents = sqliteTable(
  'comparison_events',
  {
    id: integer('id').primaryKey(),
    /** Opaque per-browser id from the `prq_sid` cookie. Not linked to a person. */
    sessionId: text('session_id').notNull(),
    /** Truncated to the minute — the dedup window. */
    minuteBucket: timestamp('minute_bucket').notNull(),
    corridorId: integer('corridor_id').references(() => corridors.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().default(NOW_MS),
  },
  (t) => [
    uniqueIndex('comparison_events_dedup_idx').on(t.sessionId, t.minuteBucket),
    index('comparison_events_created_idx').on(t.createdAt),
  ],
)

/**
 * The current top-ranked provider per corridor.
 *
 * Needed because "the best rate changed hands N times" is a claim about a
 * transition, and a transition cannot be derived from rate_quotes without
 * replaying the whole history. The refresh compares against this row, counts a
 * change, then overwrites it.
 */
export const corridorLeaders = sqliteTable('corridor_leaders', {
  corridorId: integer('corridor_id')
    .primaryKey()
    .references(() => corridors.id, { onDelete: 'cascade' }),
  providerId: integer('provider_id')
    .notNull()
    .references(() => providers.id, { onDelete: 'cascade' }),
  since: timestamp('since').notNull().default(NOW_MS),
})

export type BankBenchmark = typeof bankBenchmarks.$inferSelect
export type SavingsLedgerRow = typeof savingsLedger.$inferSelect
export type SiteStatsDaily = typeof siteStatsDaily.$inferSelect

/**
 * Fixed-window counters for the limits that must hold across Worker isolates:
 * alert sign-ups per IP and admin password guesses (lib/limits.ts). Each
 * isolate's own memory is enough of a brake for clicks and the comparison
 * beacon, which do not need one more D1 write per request.
 */
export const rateLimits = sqliteTable('rate_limits', {
  /** What is limited and for whom, e.g. `admin-fail:203.0.113.7`. */
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start').notNull(),
  hits: integer('hits').notNull(),
})
