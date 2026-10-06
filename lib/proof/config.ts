/**
 * Thresholds and constants behind the trust claims.
 *
 * Every value a claim depends on lives here rather than inline in a component,
 * so that "why is this line showing?" is answerable by reading one file
 * alongside the numbers in /admin → Claims currently visible.
 */

/**
 * The day the savings ledger started recording. Shown on /how-we-rank#savings
 * so "since launch" has a date attached rather than being open-ended.
 *
 * Changing this does not change any total — sums run over the ledger itself,
 * and a row cannot predate the table.
 */
export const LAUNCH_DATE = new Date('2026-09-01T00:00:00Z')

/** How long getProofStats() reuses a computed result. */
export const PROOF_CACHE_MS = 5 * 60 * 1000

/**
 * A claim stays hidden until its threshold is met. Below it, the line does not
 * render at all — there is no placeholder and no rounded-up stand-in, because
 * a made-up proof number is worse than no proof number.
 */
export const THRESHOLDS = {
  /** "N comparisons run this month" appears at 1,000. */
  comparisonsThisMonth: 1_000,
  /** "₨ N saved since launch" appears at 25 lakh. */
  savingsSinceLaunch: 2_500_000,
} as const

/**
 * Enables "Pakistan's first Pakistan-only remittance comparison site".
 *
 * MUST stay false until someone has actually run a competitor check and can
 * point to the evidence. It is an unfalsifiable-sounding claim that is trivially
 * falsifiable in practice, and the ASA treats "first" as a factual claim
 * requiring substantiation. Flipping this without doing the search is the one
 * change in this repo that could make the site's own honesty pitch a lie.
 */
export const CLAIM_FIRST_PAKISTAN_ONLY_SITE = false
