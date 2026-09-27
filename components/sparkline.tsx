/**
 * A minimal SVG sparkline.
 *
 * Deliberately not a charting library: the design calls for a 84×28 polyline,
 * and pulling in a chart package would cost more JavaScript than the entire rest
 * of the page. This renders server-side and ships no client JS at all.
 */
interface SparklineProps {
  points: { rate: number }[]
  width?: number
  height?: number
  /** Green for up, red for down. The arrow glyph carries the meaning too. */
  trend?: 'up' | 'down' | 'flat'
  className?: string
}

export function Sparkline({
  points,
  width = 84,
  height = 28,
  trend = 'flat',
  className,
}: SparklineProps) {
  // Two points is the minimum that draws a line; below that, render nothing
  // rather than a misleading flat line at an arbitrary height.
  if (points.length < 2) return null

  const rates = points.map((p) => p.rate)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const range = max - min

  /**
   * Normalising to min/max makes any series fill the full height, which turns
   * rounding noise into a dramatic-looking swing — a 0.01% wobble rendered as a
   * cliff next to a "0.0% this week" label. On a rates page that is actively
   * misleading, so a series whose whole range is under 0.15% of its value is
   * drawn flat, which is what it actually is.
   */
  const relativeRange = max > 0 ? range / max : 0
  const isFlat = relativeRange < 0.0015

  // Inset by the stroke width so the line never clips at the edges.
  const pad = 2
  const usableHeight = height - pad * 2

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width
    const normalised = isFlat || range === 0 ? 0.5 : (point.rate - min) / range
    // SVG y grows downward, so a higher rate needs a smaller y.
    const y = pad + (1 - normalised) * usableHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const stroke =
    trend === 'up' ? 'var(--color-up)' : trend === 'down' ? 'var(--color-down)' : '#7aa596'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={coords.join(' ')} />
    </svg>
  )
}
