/**
 * The first-load splash (PakLoader) plays once per tab session.
 *
 * SPLASH_SCRIPT runs before first paint and marks <html> when this tab has
 * already seen it, so a reload never flashes the overlay. A data attribute,
 * not a class: React owns <html>'s className and could write over it.
 */

export const SPLASH_SEEN_KEY = 'data-splash-seen'

export const SPLASH_SCRIPT = `(function(){try{
if(sessionStorage.getItem(${JSON.stringify(SPLASH_SEEN_KEY)}))document.documentElement.setAttribute(${JSON.stringify(SPLASH_SEEN_KEY)},'')
}catch(e){}})()`
