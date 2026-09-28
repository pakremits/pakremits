/**
 * Where each corridor's arc starts on the hero map: a major city in the
 * sending country, as longitude and latitude. Shared by the home hero (every
 * corridor) and the corridor pages (just their own). The Eurozone uses Germany.
 */
export const HERO_ORIGINS: Record<string, { lon: number; lat: number }> = {
  uk: { lon: -1.5, lat: 52.5 },
  uae: { lon: 55.3, lat: 25.2 },
  'saudi-arabia': { lon: 46.7, lat: 24.7 },
  qatar: { lon: 51.5, lat: 25.3 },
  usa: { lon: -95, lat: 38 },
  canada: { lon: -79.4, lat: 43.7 },
  eurozone: { lon: 10, lat: 51 },
  australia: { lon: 151.2, lat: -33.9 },
}
