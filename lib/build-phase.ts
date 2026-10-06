/**
 * True inside `next build`, in the processes that render the static pages.
 *
 * Read helpers that degrade on a database error (an empty list, a hidden
 * claim) rethrow here instead: a degraded page would be published and served
 * until the next deploy, while a failed build leaves the last good site up.
 */
export const IN_STATIC_BUILD = process.env.NEXT_PHASE === 'phase-production-build'
