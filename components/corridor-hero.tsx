'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCorridorScene,
  type HeroColors,
  type HeroCorridor,
  type HeroHome,
} from '@/lib/hero/corridor-scene'

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

/** The band fills the header so the southern corridors (Australia) stay on the map. */
const BAND = 'absolute inset-0'

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
const serverTheme = () => 'light' as const

export function CorridorHero({
  corridors,
  home,
  className = '',
  children,
}: {
  corridors: HeroCorridor[]
  /** Tooltip for the Pakistan marker. */
  home?: HeroHome
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme)
  const hostRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // Compared by value, so a re-render with equal data never restarts the scene.
  const corridorsKey = JSON.stringify(corridors)
  const homeKey = JSON.stringify(home ?? null)

  useEffect(() => {
    if (!canvasRef.current || !hostRef.current) return
    const scene = createCorridorScene(canvasRef.current, {
      colors: COLORS[theme],
      corridors: JSON.parse(corridorsKey) as HeroCorridor[],
      home: (JSON.parse(homeKey) as HeroHome | null) ?? undefined,
      eventTarget: hostRef.current,
      overlay: overlayRef.current,
      ignore: (event) => event.target instanceof Element && event.target.closest('#compare') !== null,
      onCorridorClick: (corridor) => router.push(corridor.href),
    })
    return () => scene.destroy()
  }, [theme, corridorsKey, homeKey, router])

  return (
    <header ref={hostRef} className={`relative ${className}`}>
      <div aria-hidden="true" className={`hero-gradient ${BAND}`}>
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {children}

      {/* Above the headline, below the search card (which sits at z-[2]). */}
      <div aria-hidden="true" className={`pointer-events-none z-[1] ${BAND}`}>
        <canvas ref={overlayRef} className="block h-full w-full" />
      </div>
    </header>
  )
}
