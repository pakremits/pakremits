/**
 * Guesses the visitor's sending corridor from the browser's timezone.
 *
 * The home page is cached and served the same to everyone, and Fly sends no
 * visitor-country header, so the guess is made in the browser. The timezone is
 * the device's own setting: no IP lookup, no request, nothing leaves the page,
 * and it is still right behind a VPN. Visitors outside the eight corridors get
 * `null` and the page's default stays.
 */

const EXACT: Record<string, string> = {
  'Europe/London': 'uk',
  'Europe/Belfast': 'uk',
  GB: 'uk',
  'Asia/Dubai': 'uae',
  'Asia/Riyadh': 'saudi-arabia',
  'Asia/Qatar': 'qatar',
  // Hawaii is the one US state outside America/.
  'Pacific/Honolulu': 'usa',
  // Eurozone members' zones outside Europe/.
  'Atlantic/Madeira': 'eurozone',
  'Atlantic/Azores': 'eurozone',
  'Atlantic/Canary': 'eurozone',
  'Africa/Ceuta': 'eurozone',
  'Asia/Nicosia': 'eurozone',
  'Asia/Famagusta': 'eurozone',
}

const US_ZONES = new Set([
  'New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage', 'Juneau',
  'Sitka', 'Metlakatla', 'Yakutat', 'Nome', 'Adak', 'Boise', 'Detroit', 'Menominee',
  'Indianapolis', 'Fort_Wayne', 'Louisville',
])

const CANADA_ZONES = new Set([
  'Toronto', 'Montreal', 'Vancouver', 'Edmonton', 'Calgary', 'Winnipeg', 'Regina',
  'Swift_Current', 'Halifax', 'Glace_Bay', 'Moncton', 'Goose_Bay', 'St_Johns',
  'Whitehorse', 'Dawson', 'Dawson_Creek', 'Fort_Nelson', 'Creston', 'Yellowknife',
  'Inuvik', 'Cambridge_Bay', 'Rankin_Inlet', 'Resolute', 'Iqaluit', 'Pangnirtung',
  'Atikokan', 'Coral_Harbour', 'Nipigon', 'Thunder_Bay', 'Rainy_River', 'Blanc-Sablon',
])

/** The 20 euro members, plus the microstates that use the euro. */
const EURO_ZONES = new Set([
  'Dublin', 'Paris', 'Berlin', 'Busingen', 'Madrid', 'Rome', 'Amsterdam', 'Brussels',
  'Luxembourg', 'Vienna', 'Lisbon', 'Helsinki', 'Mariehamn', 'Athens', 'Vilnius',
  'Riga', 'Tallinn', 'Bratislava', 'Ljubljana', 'Zagreb', 'Malta', 'Nicosia',
  'Monaco', 'Andorra', 'San_Marino', 'Vatican', 'Podgorica',
])

/** The corridor slug for an IANA timezone, or null outside the eight corridors. */
export function corridorForTimeZone(timeZone: string): string | null {
  if (EXACT[timeZone]) return EXACT[timeZone]
  const [area, ...rest] = timeZone.split('/')
  const city = rest.join('/')
  if (area === 'Australia') return 'australia'
  if (area === 'Canada') return 'canada'
  if (area === 'US') return 'usa'
  if (area === 'Europe') return EURO_ZONES.has(city) ? 'eurozone' : null
  if (area === 'America') {
    // America/Indiana/Knox, America/Kentucky/Monticello, America/North_Dakota/Center.
    if (/^(Indiana|Kentucky|North_Dakota)\//.test(city)) return 'usa'
    if (US_ZONES.has(city)) return 'usa'
    if (CANADA_ZONES.has(city)) return 'canada'
  }
  return null
}

let detected: string | null | undefined

/** The visitor's corridor from this browser's timezone, or null. Client only. */
export function detectVisitorCorridor(): string | null {
  if (detected !== undefined) return detected
  try {
    detected = corridorForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')
  } catch {
    detected = null
  }
  return detected
}
