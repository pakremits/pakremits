CREATE TABLE `affiliate_clicks` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider_id` integer NOT NULL,
	`corridor_id` integer,
	`amount_sent` real,
	`delivery_method` text,
	`click_id` text NOT NULL,
	`referrer` text,
	`utm` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliate_clicks_click_id_unique` ON `affiliate_clicks` (`click_id`);--> statement-breakpoint
CREATE INDEX `affiliate_clicks_created_idx` ON `affiliate_clicks` (`created_at`);--> statement-breakpoint
CREATE TABLE `bank_benchmarks` (
	`id` integer PRIMARY KEY NOT NULL,
	`corridor_id` integer NOT NULL,
	`delivery_method` text NOT NULL,
	`rate` real NOT NULL,
	`fee` real NOT NULL,
	`note` text,
	`pinned` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_benchmarks_slot_idx` ON `bank_benchmarks` (`corridor_id`,`delivery_method`);--> statement-breakpoint
CREATE TABLE `comparison_events` (
	`id` integer PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`minute_bucket` integer NOT NULL,
	`corridor_id` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comparison_events_dedup_idx` ON `comparison_events` (`session_id`,`minute_bucket`);--> statement-breakpoint
CREATE INDEX `comparison_events_created_idx` ON `comparison_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `corridor_leaders` (
	`corridor_id` integer PRIMARY KEY NOT NULL,
	`provider_id` integer NOT NULL,
	`since` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `corridors` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`from_currency` text NOT NULL,
	`from_country` text NOT NULL,
	`from_country_name` text NOT NULL,
	`to_currency` text DEFAULT 'PKR' NOT NULL,
	`currency_symbol` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `corridors_slug_unique` ON `corridors` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `corridors_from_currency_idx` ON `corridors` (`from_currency`);--> statement-breakpoint
CREATE TABLE `cron_runs` (
	`id` integer PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`started_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`finished_at` integer,
	`quotes_written` integer DEFAULT 0 NOT NULL,
	`adapters_ok` integer DEFAULT 0 NOT NULL,
	`adapters_failed` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `latest_quotes` (
	`corridor_id` integer NOT NULL,
	`delivery_method` text NOT NULL,
	`amount_sent` real NOT NULL,
	`provider_id` integer NOT NULL,
	`rate` real NOT NULL,
	`fee` real NOT NULL,
	`amount_received` real NOT NULL,
	`delivery_speed_text` text NOT NULL,
	`delivery_speed_minutes` integer,
	`promo_flag` integer DEFAULT false NOT NULL,
	`promo_note` text,
	`source` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	`captured_at` integer NOT NULL,
	`last_good_at` integer NOT NULL,
	PRIMARY KEY(`corridor_id`, `delivery_method`, `amount_sent`, `provider_id`),
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mid_market_rates` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text DEFAULT 'PKR' NOT NULL,
	`rate` real NOT NULL,
	`captured_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mid_market_lookup_idx` ON `mid_market_rates` (`from_currency`,`captured_at`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`brand_color` text DEFAULT '#8A8F8C' NOT NULL,
	`brand_text_color` text DEFAULT '#FFFFFF' NOT NULL,
	`homepage_url` text NOT NULL,
	`affiliate_url_template` text,
	`affiliate_network` text DEFAULT 'none' NOT NULL,
	`commission_note` text,
	`supports_bank` integer DEFAULT false NOT NULL,
	`supports_wallet` integer DEFAULT false NOT NULL,
	`supports_neobank` integer DEFAULT false NOT NULL,
	`supports_cash` integer DEFAULT false NOT NULL,
	`supports_rda` integer DEFAULT false NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`is_benchmark` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_slug_unique` ON `providers` (`slug`);--> statement-breakpoint
CREATE TABLE `rate_alerts` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_contact` text NOT NULL,
	`channel` text NOT NULL,
	`from_currency` text NOT NULL,
	`target_rate` real NOT NULL,
	`direction` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`wants_digest` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`last_triggered_at` integer,
	`last_digest_at` integer,
	`confirmed_at` integer,
	`unsubscribe_token` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_alerts_unsubscribe_token_unique` ON `rate_alerts` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `rate_alerts_contact_idx` ON `rate_alerts` (`user_contact`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_quotes` (
	`id` integer PRIMARY KEY NOT NULL,
	`provider_id` integer NOT NULL,
	`corridor_id` integer NOT NULL,
	`delivery_method` text NOT NULL,
	`amount_sent` real NOT NULL,
	`rate` real NOT NULL,
	`fee` real NOT NULL,
	`amount_received` real NOT NULL,
	`delivery_speed_text` text NOT NULL,
	`delivery_speed_minutes` integer,
	`promo_flag` integer DEFAULT false NOT NULL,
	`promo_note` text,
	`captured_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	`source` text NOT NULL,
	`stale` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rate_quotes_captured_idx` ON `rate_quotes` (`captured_at`);--> statement-breakpoint
CREATE TABLE `savings_ledger` (
	`id` integer PRIMARY KEY NOT NULL,
	`affiliate_click_id` integer NOT NULL,
	`corridor_id` integer,
	`provider_id` integer NOT NULL,
	`amount_sent` real NOT NULL,
	`provider_received_pkr` real NOT NULL,
	`bank_received_pkr` real,
	`saving_pkr` real,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)) NOT NULL,
	FOREIGN KEY (`affiliate_click_id`) REFERENCES `affiliate_clicks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`corridor_id`) REFERENCES `corridors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `savings_ledger_affiliate_click_id_unique` ON `savings_ledger` (`affiliate_click_id`);--> statement-breakpoint
CREATE INDEX `savings_ledger_created_idx` ON `savings_ledger` (`created_at`);--> statement-breakpoint
CREATE TABLE `site_stats_daily` (
	`date` text PRIMARY KEY NOT NULL,
	`comparisons_run` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`saving_pkr_total` real DEFAULT 0 NOT NULL,
	`best_provider_changes` integer DEFAULT 0 NOT NULL
);
