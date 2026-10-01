/**
 * The first-load splash (PakLoader) plays once per tab session.
 *
 * SPLASH_SCRIPT runs before first paint and marks <html> (which hides the
 * overlay) when the splash should not cover the page:
 *
 * - this tab has already seen it, so a reload never flashes it;
 * - the visitor came from another site, such as a search result: they asked
 *   for this page, and a logo in the way costs bounces back to the results;
 * - a crawler or automated browser is rendering the page.
 *
 * Otherwise it also starts the hard cap here, before hydration, so a slow
 * phone can never keep the page covered past CAP_MS. A data attribute, not a
 * class: React owns <html>'s className and could write over it.
 */

export const SPLASH_SEEN_KEY = 'data-splash-seen'

/** The longest the splash may cover the page, counted from first paint. */
export const SPLASH_CAP_MS = 3000

export const SPLASH_SCRIPT = `(function(){try{
var d=document.documentElement,k=${JSON.stringify(SPLASH_SEEN_KEY)},skip=sessionStorage.getItem(k);
if(!skip&&document.referrer){try{skip=new URL(document.referrer).origin!==location.origin}catch(e){}}
if(!skip)skip=/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent);
if(skip){d.setAttribute(k,'');return}
setTimeout(function(){d.setAttribute(k,'')},${SPLASH_CAP_MS})
}catch(e){}})()`
