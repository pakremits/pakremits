/**
 * How often rates are refreshed, and everything that follows from it.
 *
 * One setting drives every statement about freshness: the copy that says how
 * often rates are checked, the point at which a quote is flagged as out of
 * date, and the /admin alarm for a late refresh. Staging refreshes once a day
 * (1440), production three times a day (480). The charts' 24-hour view needs
 * no setting: it only appears when there are enough captures in a day.
 *
 * NEXT_PUBLIC_, so the browser code that judges staleness against the
 * reader's own clock is compiled with the same value as the build.
 */
import type { Locale } from '@/i18n/routing'

const DEFAULT_INTERVAL_MINUTES = 1440

function parseInterval(raw: string | undefined): number {
  const minutes = Number(raw)
  return Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_INTERVAL_MINUTES
}

export const REFRESH_INTERVAL_MINUTES = parseInterval(
  process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MINUTES,
)

/**
 * A quote older than this is flagged rather than presented as current. One and
 * a half intervals, so a refresh that is merely running late does not trip it.
 */
export const STALE_AFTER_MS = REFRESH_INTERVAL_MINUTES * 60_000 * 1.5

/** Whether a capture is too old to present as current, judged at `now`. */
export function isOutOfDate(capturedAt: Date | number, now: number): boolean {
  const time = typeof capturedAt === 'number' ? capturedAt : capturedAt.getTime()
  return now - time > STALE_AFTER_MS
}

/** "once a day", "every 8 hours", "every 15 minutes", in the reader's language. */
export function refreshCadence(locale: Locale = 'en', minutes = REFRESH_INTERVAL_MINUTES): string {
  const days = minutes / 1440
  const hours = minutes / 60
  if (locale === 'ur') {
    if (minutes === 1440) return 'روزانہ ایک بار'
    if (Number.isInteger(days)) return `ہر ${days} دن بعد`
    if (minutes === 60) return 'ہر گھنٹے'
    if (Number.isInteger(hours)) return `ہر ${hours} گھنٹے بعد`
    return `ہر ${minutes} منٹ بعد`
  }
  if (minutes === 1440) return 'once a day'
  if (Number.isInteger(days)) return `every ${days} days`
  if (minutes === 60) return 'every hour'
  if (Number.isInteger(hours)) return `every ${hours} hours`
  return `every ${minutes} minutes`
}

/** How old a quote may get before it is flagged: "36 hours", "90 minutes". */
export function staleAfterPhrase(): string {
  const minutes = Math.round(STALE_AFTER_MS / 60_000)
  if (minutes % 60 !== 0) return `${minutes} minutes`
  return minutes === 60 ? 'an hour' : `${minutes / 60} hours`
}
