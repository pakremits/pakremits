'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCorridorScene,
  type HeroColors,
  type HeroCorridor,
  type HeroHome,
  type ScenePair,
} from '@/lib/hero/corridor-scene'
import { COUNTRY_DOTS } from '@/lib/hero/country-dots'

export type { HeroCorridor, HeroHome }

/**
 * The home page's green header band, drawn as an interactive world map with
 * each sending corridor arcing into Pakistan.
 *
 * Renders the <header> itself so the whole header can take pointer events: the
 * headline sits above the map, and hovering through it still lights the map.
 * The search card sits on the band, so anything inside `#compare` is ignored:
 * typing into the form must never open a corridor.
 *
 * The band's .hero-gradient shows during SSR and before the scene's first frame;
 * the canvas repeats the same three stops per theme so the swap is invisible.
 */

const COLORS: Record<'light' | 'dark', HeroColors> = {
  light: { deep: '#037252', mid: '#14936f', bright: '#02d39c', accent: '#e0a513' },
  dark: { deep: '#024e38', mid: '#0e644b', bright: '#018f6a', accent: '#e0a513' },
}

/**
 * Keeps the mascot (`data-hero-mascot`) off Pakistan: slides it left when
 * there is room to clear Pakistan without covering the text
 * (`data-hero-copy`), and otherwise refits the map into the space left of it. Left-to-right only:
 * the Urdu layout puts the mascot on the other side.
 */
function clearPakistan(
  host: HTMLElement | null,
  pk: { left: number; right: number; top: number; bottom: number },
  refit: (area: { left: number; width: number; top: number; height: number; alignEnd?: boolean }) => void,
) {
  const mascot = host?.querySelector<HTMLElement>('[data-hero-mascot]')
  if (!host || !mascot || getComputedStyle(host).direction === 'rtl') return
  // These bounds are the answer to our own refit, which already placed the
  // mascot to suit them: re-checking would undo that and refit forever.
  if (host.dataset.refitting) {
    delete host.dataset.refitting
    return
  }
  mascot.style.translate = ''
  const m = mascot.getBoundingClientRect()
  // Not loaded yet (no size): measure again once it is.
  if (!m.width) {
    mascot.addEventListener('load', () => clearPakistan(host, pk, refit), { once: true })
    return
  }
  const origin = host.getBoundingClientRect()
  const left = m.left - origin.left
  const right = m.right - origin.left
  const top = m.top - origin.top
  const bottom = m.bottom - origin.top
  const overlaps = pk.left < right && pk.right > left && pk.top < bottom && pk.bottom > top
  if (!overlaps) return
  const copyRight = Math.max(
    0,
    ...[...host.querySelectorAll('[data-hero-copy]')].map((el) => el.getBoundingClientRect().right - origin.left),
  )
  // Only a move that clears Pakistan completely: stopping halfway would
  // plant the mascot in the middle of it (the Gulf pages, where Pakistan
  // fills the right half).
  const wanted = right - pk.left + 16
  const room = Math.max(0, left - copyRight - 16)
  if (wanted <= room) {
    mascot.style.translate = `${-wanted}px 0`
    return
  }
  // No room to step aside: fit the map into the space left of the mascot
  // instead, pushed against it (and a little behind) so no gap opens beside it. The area starts
  // a little outside the text column, not at the window's edge, so wide
  // screens do not strand the map far left. The refit reports new bounds,
  // which then clear the mascot.
  // Where the window has an empty right margin, the mascot steps out into
  // it first, which gives the map that much more room.
  const h = origin.height
  const out = Math.max(0, Math.min(200, origin.width - right - 32))
  if (out > 0) mascot.style.translate = `${out}px 0`
  const column = Math.max(0, (origin.width - 1120) / 2)
  const fitLeft = Math.max(origin.width * 0.04, column - 80)
  // A large Pakistan (the Gulf pages) may run into the mascot's first half:
  // it still reads with him standing on its eastern edge. A small one must
  // stay clear of him.
  const overlap = pk.right - pk.left > m.width * 1.5 ? m.width * 0.45 : -24
  host.dataset.refitting = '1'
  refit({
    left: fitLeft,
    width: Math.max(200, left + out + overlap - fitLeft),
    top: h * 0.06,
    height: h * 0.74,
    alignEnd: true,
  })
}

function pairOf(slug: string | undefined): ScenePair | undefined {
  const from = slug ? COUNTRY_DOTS[slug] : undefined
  return from ? { from, to: COUNTRY_DOTS.pakistan } : undefined
}

/** The band fills the header so the southern corridors (Australia) stay on the map. */
const BAND = 'absolute inset-0'

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
/** lg: where the corridor pages show the map at all. */
const WIDE = '(min-width: 1024px)'
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const currentWide = () => window.matchMedia(WIDE).matches
const serverWide = () => false

const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
const serverTheme = () => 'light' as const

export function CorridorHero({
  corridors,
  home,
  homeAt,
  veilAt,
  pairFrom,
  wideOnly = false,
  className = '',
  children,
}: {
  corridors: HeroCorridor[]
  /** Tooltip for the Pakistan marker. */
  home?: HeroHome
  /** Pakistan's place in the band and the text veil's, as fractions; the
   *  corridor pages move both for their left-aligned layout. */
  homeAt?: { x: number; y: number }
  veilAt?: { x: number; y: number }
  /** A corridor slug: draw that country and Pakistan instead of the world. */
  pairFrom?: string
  /** No map (and no pointer handling) below lg: just the gradient band. */
  wideOnly?: boolean
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme)
  const wide = useSyncExternalStore(subscribeWide, currentWide, serverWide)
  const showMap = !wideOnly || wide
  const hostRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // Compared by value, so a re-render with equal data never restarts the scene.
  const corridorsKey = JSON.stringify(corridors)
  const homeKey = JSON.stringify(home ?? null)
  const placeKey = JSON.stringify({ homeAt, veilAt })

  useEffect(() => {
    if (!showMap || !canvasRef.current || !hostRef.current) return
    const handle: { scene?: ReturnType<typeof createCorridorScene> } = {}
    const scene = (handle.scene = createCorridorScene(canvasRef.current, {
      colors: COLORS[theme],
      corridors: JSON.parse(corridorsKey) as HeroCorridor[],
      home: (JSON.parse(homeKey) as HeroHome | null) ?? undefined,
      ...(JSON.parse(placeKey) as { homeAt?: { x: number; y: number }; veilAt?: { x: number; y: number } }),
      pair: pairOf(pairFrom),
      // Deferred: the first layout runs inside createCorridorScene, before
      // `scene` is assigned.
      onHomeBounds: (bounds) =>
        queueMicrotask(() => clearPakistan(hostRef.current, bounds, (area) => handle.scene?.fitPairInto?.(area))),
      eventTarget: hostRef.current,
      overlay: overlayRef.current,
      ignore: (event) => event.target instanceof Element && event.target.closest('#compare') !== null,
      // A corridor page's own arc points at the page it is on.
      onCorridorClick: (corridor) => {
        if (corridor.href !== window.location.pathname) router.push(corridor.href)
      },
    }))
    return () => scene.destroy()
  }, [showMap, theme, corridorsKey, homeKey, placeKey, pairFrom, router])

  return (
    <header ref={hostRef} className={`relative ${className}`}>
      <div aria-hidden="true" className={`hero-gradient ${BAND}`}>
        <canvas ref={canvasRef} className={`block h-full w-full ${wideOnly ? 'max-lg:hidden' : ''}`} />
      </div>

      {children}

      {/* Above the headline, below the search card (which sits at z-[2]). */}
      <div aria-hidden="true" className={`pointer-events-none z-[1] ${BAND}`}>
        <canvas ref={overlayRef} className={`block h-full w-full ${wideOnly ? 'max-lg:hidden' : ''}`} />
      </div>
    </header>
  )
}
