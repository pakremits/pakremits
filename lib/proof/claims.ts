/**
 * Which trust claims are true enough to show, right now.
 *
 * One module decides this for the whole site so the hero, the proof strip, the
 * methodology page and the /admin "claims currently visible" panel can never
 * disagree about what is on screen. Adding a claim means adding it here, not
 * writing a threshold check inside a component.
 *
 * The rule throughout: below its threshold a claim does not render. There is no
 * placeholder, no "coming soon", and no rounded-up stand-in.
 */
import { refreshCadence } from '@/lib/cadence'
import { CLAIM_FIRST_PAKISTAN_ONLY_SITE, THRESHOLDS } from './config'
import type { ProofStats } from './stats'

export type ClaimId =
  | 'pakistanOnly'
  | 'providersRefreshed'
  | 'liveGap'
  | 'rankedByRupees'
  | 'monthlyActivity'
  | 'savingsSinceLaunch'
  | 'firstPakistanOnlySite'

export interface ClaimState {
  id: ClaimId
  visible: boolean
  /** Why it is or is not showing — rendered verbatim in the admin panel. */
  reason: string
}

export interface ClaimContext {
  stats: ProofStats
  /** Best provider payout minus bank benchmark payout, for the widget's
   *  current corridor and amount. Null when the corridor has no benchmark. */
  liveGapOnStandardAmount: number | null
}

/**
 * Evaluate every claim against the current numbers.
 *
 * Returns all of them, visible or not, because /admin needs to show the ones
 * that are hidden and why.
 */
export function evaluateClaims({
  stats,
  liveGapOnStandardAmount,
}: ClaimContext): ClaimState[] {
  const dbUp = !stats.unavailable

  return [
    {
      id: 'pakistanOnly',
      visible: true,
      reason: 'Always shown. A statement about scope, not a measurement.',
    },
    {
      id: 'providersRefreshed',
      visible: dbUp && stats.providersCompared > 0,
      reason: dbUp
        ? `${stats.providersCompared} active providers, refreshed ${refreshCadence('en', stats.refreshMinutes)}.`
        : 'Hidden: the provider count could not be read.',
    },
    {
      id: 'liveGap',
      visible: liveGapOnStandardAmount !== null && liveGapOnStandardAmount > 0,
      reason:
        liveGapOnStandardAmount === null
          ? 'Hidden: no bank benchmark for the selected corridor and rail.'
          : liveGapOnStandardAmount > 0
            ? `Live gap is ${Math.round(liveGapOnStandardAmount)} PKR.`
            : 'Hidden: the best provider is not currently ahead of the benchmark.',
    },
    {
      id: 'rankedByRupees',
      visible: true,
      reason: 'Always shown. A statement about method, enforced by rankQuotes.',
    },
    {
      id: 'monthlyActivity',
      visible: dbUp && stats.comparisonsThisMonth >= THRESHOLDS.comparisonsThisMonth,
      reason: `${stats.comparisonsThisMonth} of ${THRESHOLDS.comparisonsThisMonth} comparisons needed this month.`,
    },
    {
      id: 'savingsSinceLaunch',
      visible: dbUp && stats.savingsSinceLaunch >= THRESHOLDS.savingsSinceLaunch,
      reason: `${Math.round(stats.savingsSinceLaunch)} of ${THRESHOLDS.savingsSinceLaunch} PKR needed since launch.`,
    },
    {
      id: 'firstPakistanOnlySite',
      visible: CLAIM_FIRST_PAKISTAN_ONLY_SITE,
      reason: CLAIM_FIRST_PAKISTAN_ONLY_SITE
        ? 'Enabled in lib/proof/config.ts. A competitor check must back this up.'
        : 'Disabled in lib/proof/config.ts pending a competitor check.',
    },
  ]
}

/** Convenience lookup: `claims.savingsSinceLaunch` → boolean. */
export function claimMap(states: ClaimState[]): Record<ClaimId, boolean> {
  return Object.fromEntries(states.map((c) => [c.id, c.visible])) as Record<ClaimId, boolean>
}
