import { useId } from 'react'
import type { RatePoint } from '@/lib/quotes'

/**
 * The rate page banner's backdrop: the recent rate as a gold line with a gold
 * wash beneath it, running the full width of the banner behind the numbers.
 *
 * Decorative (the interactive chart below the banner is the readable one), so
 * it is hidden from assistive tech. Server-rendered SVG: no JavaScript.
 * `preserveAspectRatio="none"` stretches it to the banner at any width; the
 * stroke keeps its thickness through `vector-effect`.
 */
export function RateBackdrop({ points, className = '' }: { points: RatePoint[]; className?: string }) {
  const gradientId = useId()
  if (points.length < 2) return null

  const width = 1000
  const height = 200
  const rates = points.map((p) => p.rate)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const spread = max - min || 1
  // Keep the line in the upper part of the band, with room under it for the wash.
  const top = 24
  const bottom = 150
  const t0 = points[0].t
  const tSpan = points[points.length - 1].t - t0 || 1
  const toX = (t: number) => ((t - t0) / tSpan) * width
  const toY = (rate: number) => bottom - ((rate - min) / spread) * (bottom - top)

  const line = points.map((p) => `${toX(p.t).toFixed(1)},${toY(p.rate).toFixed(1)}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {/* Light and quick to fade: a heavier wash muddies the green into olive. */}
          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.2" />
          <stop offset="70%" stopColor="var(--color-gold)" stopOpacity="0.03" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
