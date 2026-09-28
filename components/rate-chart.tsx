/**
 * 30-day mid-market chart for corridor and rate pages.
 *
 * Hand-rolled SVG rather than a charting library, for the same reason as the
 * sparkline: this ships zero client JavaScript, and a chart package would be
 * heavier than every other asset on the page combined.
 *
 * Unlike the sparkline, this one labels its axis. A zoomed y-axis is only
 * misleading when the reader cannot see the range — printing the high and low
 * makes a 0.4% move legible as a 0.4% move even though the line fills the box.
 */
import { round } from '@/lib/ranking/compute'

interface RateChartProps {
  points: { date: Date; rate: number }[]
  currency: string
  /** Accessible summary. The SVG itself is decorative once this is read. */
  label: string
  height?: number
  /** Drop the panel frame, for a chart that sits inside another panel. */
  bare?: boolean
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

export function RateChart({ points, currency, label, height = 220, bare = false }: RateChartProps) {
  if (points.length < 2) {
    return (
      <p className="rounded-panel bg-surface p-6 text-sm text-muted">
        Not enough history yet to chart {currency} against the rupee. The first full day of
        readings appears here tomorrow.
      </p>
    )
  }

  const width = 720
  const padLeft = 8
  const padRight = 8
  const padTop = 16
  const padBottom = 28

  const rates = points.map((p) => p.rate)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const range = max - min || 1

  // Pad the vertical scale by 10% so the line never touches the frame edge.
  const lo = min - range * 0.1
  const hi = max + range * 0.1
  const span = hi - lo

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const toX = (index: number) => padLeft + (index / (points.length - 1)) * plotWidth
  const toY = (rate: number) => padTop + (1 - (rate - lo) / span) * plotHeight

  const line = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.rate).toFixed(1)}`).join(' ')

  // Close the path along the baseline for the subtle fill under the line.
  const area =
    `${padLeft},${padTop + plotHeight} ` + line + ` ${padLeft + plotWidth},${padTop + plotHeight}`

  const first = points[0]
  const last = points[points.length - 1]
  const changePercent = round(((last.rate - first.rate) / first.rate) * 100, 2)
  const rising = changePercent > 0

  return (
    <figure className={bare ? '' : 'rounded-panel bg-surface p-6'}>
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{label}</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Mid-market reference, {DATE_FMT.format(first.date)} to {DATE_FMT.format(last.date)}
          </p>
        </div>
        <div className="text-right">
          <b className="block font-display text-2xl font-semibold tabular-nums">
            {last.rate.toFixed(2)}
          </b>
          <span
            className="text-[13px] tabular-nums"
            style={{ color: rising ? 'var(--color-ok)' : 'var(--color-danger)' }}
          >
            {rising ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}% over the period
          </span>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}. High ${max.toFixed(2)}, low ${min.toFixed(2)}, currently ${last.rate.toFixed(2)}, ${
          rising ? 'up' : 'down'
        } ${Math.abs(changePercent).toFixed(2)} percent over the period.`}
      >
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-leaf)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-leaf)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal guides at the high and low, so the zoom is legible. */}
        {[max, min].map((value) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={toY(value)}
              y2={toY(value)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={padLeft + 4}
              y={toY(value) - 5}
              className="fill-faint text-[11px] tabular-nums"
              style={{ fontSize: 11 }}
            >
              {value.toFixed(2)}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#rateFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-leaf)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={toX(points.length - 1)} cy={toY(last.rate)} r="4" fill="var(--color-leaf)" />

        <text x={padLeft} y={height - 8} className="fill-faint" style={{ fontSize: 11 }}>
          {DATE_FMT.format(first.date)}
        </text>
        <text
          x={width - padRight}
          y={height - 8}
          textAnchor="end"
          className="fill-faint"
          style={{ fontSize: 11 }}
        >
          {DATE_FMT.format(last.date)}
        </text>
      </svg>

      <p className="mt-3 text-xs text-faint">
        High {max.toFixed(2)} · Low {min.toFixed(2)} · This is the mid-market rate, which no
        provider gives you. It is the line they are all measured against.
      </p>
    </figure>
  )
}
