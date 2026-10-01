'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { RateHistory, RatePoint } from '@/lib/quotes'

/**
 * Mid-market rate chart with range controls (24 hours, week, month, all) and
 * a hover/keyboard readout of any point.
 *
 * Hand-rolled SVG rather than a charting library: a chart package would be
 * heavier than everything else on the page. The y-axis is zoomed to the
 * range, which is only misleading when the reader cannot see it, so the high
 * and low are printed on their guide lines.
 *
 * A range only appears when there is data for it: the 24-hour view needs
 * intraday captures, and "All" only when it reaches further back than a month.
 */

type RangeKey = '24h' | '1w' | '1m' | 'all'

const DAY_MS = 24 * 60 * 60 * 1000

const RANGES: { key: RangeKey; label: string; long: string; days?: number }[] = [
  { key: '24h', label: '24h', long: 'last 24 hours' },
  { key: '1w', label: '1W', long: 'last 7 days', days: 7 },
  { key: '1m', label: '1M', long: 'last 30 days', days: 30 },
  { key: 'all', label: 'All', long: 'all history' },
]

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' })
const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Karachi',
})

function pointsFor(history: RateHistory, range: RangeKey): RatePoint[] {
  if (range === '24h') return history.intraday
  const daily = history.daily
  const spec = RANGES.find((r) => r.key === range)
  if (!spec?.days || daily.length === 0) return daily
  const cutoff = daily[daily.length - 1].t - spec.days * DAY_MS
  return daily.filter((point) => point.t >= cutoff)
}

function available(history: RateHistory, range: RangeKey): boolean {
  if (range === '24h') return history.intraday.length >= 2
  const daily = history.daily
  if (daily.length < 2) return false
  const covered = daily[daily.length - 1].t - daily[0].t
  // "All" is only worth a tab when it shows more than the month view does.
  if (range === 'all') return covered > 31 * DAY_MS
  return pointsFor(history, range).length >= 2
}

export function RateChart({
  history,
  currency,
  title,
  defaultRange = '1m',
  height = 220,
  bare = false,
}: {
  history: RateHistory
  currency: string
  /** e.g. "GBP to PKR"; the range is added beside it. */
  title: string
  defaultRange?: RangeKey
  height?: number
  /** Drop the panel frame, for a chart that sits inside another panel. */
  bare?: boolean
}) {
  const ranges = RANGES.filter((range) => available(history, range.key))
  const initial = ranges.find((range) => range.key === defaultRange) ?? ranges.at(-1)
  const [range, setRange] = useState<RangeKey | undefined>(initial?.key)
  const [active, setActive] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gradientId = useId()

  const points = useMemo(() => (range ? pointsFor(history, range) : []), [history, range])
  const spec = RANGES.find((r) => r.key === range)

  const frame = bare ? '' : 'rounded-panel border border-line bg-surface p-6'

  if (points.length < 2) {
    return (
      <p className={`${frame || 'rounded-panel border border-line bg-surface p-6'} text-sm text-muted`}>
        Not enough history yet to chart {currency} against the rupee. The first full day of
        readings appears here tomorrow.
      </p>
    )
  }

  const width = 720
  const padX = 8
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padX * 2
  const plotHeight = height - padTop - padBottom

  const rates = points.map((p) => p.rate)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const spread = max - min || 1
  // Pad the vertical scale by 10% so the line never touches the frame edge.
  const lo = min - spread * 0.1
  const hi = max + spread * 0.1

  const t0 = points[0].t
  const tSpan = points[points.length - 1].t - t0 || 1
  const toX = (t: number) => padX + ((t - t0) / tSpan) * plotWidth
  const toY = (rate: number) => padTop + (1 - (rate - lo) / (hi - lo)) * plotHeight

  const line = points.map((p) => `${toX(p.t).toFixed(1)},${toY(p.rate).toFixed(1)}`).join(' ')
  const area = `${padX},${padTop + plotHeight} ${line} ${padX + plotWidth},${padTop + plotHeight}`

  const first = points[0]
  const last = points[points.length - 1]
  const changePercent = ((last.rate - first.rate) / first.rate) * 100
  const rising = changePercent > 0
  const intraday = range === '24h'
  const label = (t: number) => (intraday ? `${TIME_FMT.format(t)} PKT` : DAY_FMT.format(t))
  const fullLabel = (t: number) => (intraday ? `${DAY_FMT.format(t)}, ${TIME_FMT.format(t)} PKT` : DAY_FMT.format(t))

  const shown = active !== null ? points[Math.min(active, points.length - 1)] : null

  /** Nearest point to the pointer, by time. */
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((event.clientX - rect.left) / rect.width) * width
    const t = t0 + ((x - padX) / plotWidth) * tSpan
    let best = 0
    for (let i = 1; i < points.length; i++)
      if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i
    setActive(best)
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const step = event.key === 'ArrowLeft' ? -1 : 1
      setActive((current) =>
        Math.max(0, Math.min(points.length - 1, (current ?? (step < 0 ? points.length : -1)) + step)),
      )
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : points.length - 1)
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  return (
    <figure className={frame}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {title}, {spec?.long}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Mid-market reference, {fullLabel(first.t)} to {fullLabel(last.t)}
          </p>
        </div>
        <div className="text-end">
          <b className="block font-display text-2xl font-semibold tabular-nums">
            {(shown ?? last).rate.toFixed(2)}
          </b>
          <span
            className="text-[13px] tabular-nums"
            style={{ color: shown ? 'var(--color-muted)' : rising ? 'var(--color-ok)' : 'var(--color-danger)' }}
          >
            {shown
              ? fullLabel(shown.t)
              : `${rising ? '▲' : '▼'} ${Math.abs(changePercent).toFixed(2)}% over the period`}
          </span>
        </div>
      </figcaption>

      {ranges.length > 1 && (
        <div role="group" aria-label="Chart range" className="mt-4 flex w-fit gap-[3px] rounded-[10px] bg-line p-[3px]">
          {ranges.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={option.key === range}
              onClick={() => {
                setRange(option.key)
                setActive(null)
              }}
              className={`cursor-pointer rounded-[8px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                option.key === range ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-auto w-full touch-none rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
        role="img"
        tabIndex={0}
        aria-label={`${title}, ${spec?.long}. High ${max.toFixed(2)}, low ${min.toFixed(2)}, currently ${last.rate.toFixed(2)}, ${
          rising ? 'up' : 'down'
        } ${Math.abs(changePercent).toFixed(2)} percent. Use the arrow keys to read each point.`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-leaf)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-leaf)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Guides at the high and low, so the zoom is legible. */}
        {[max, min].map((value) => (
          <g key={value}>
            <line
              x1={padX}
              x2={width - padX}
              y1={toY(value)}
              y2={toY(value)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text x={padX + 4} y={toY(value) - 5} className="fill-faint tabular-nums" style={{ fontSize: 11 }}>
              {value.toFixed(2)}
            </text>
          </g>
        ))}

        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-leaf)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {shown ? (
          <g pointerEvents="none">
            <line
              x1={toX(shown.t)}
              x2={toX(shown.t)}
              y1={padTop}
              y2={padTop + plotHeight}
              stroke="var(--color-muted)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle cx={toX(shown.t)} cy={toY(shown.rate)} r="5" fill="var(--color-surface)" stroke="var(--color-leaf)" strokeWidth="2.5" />
          </g>
        ) : (
          <circle cx={toX(last.t)} cy={toY(last.rate)} r="4" fill="var(--color-leaf)" />
        )}

        <text x={padX} y={height - 8} className="fill-faint" style={{ fontSize: 11 }}>
          {label(first.t)}
        </text>
        <text x={width - padX} y={height - 8} textAnchor="end" className="fill-faint" style={{ fontSize: 11 }}>
          {label(last.t)}
        </text>
      </svg>

      {/* Read out the point under the pointer or keyboard, for screen readers. */}
      <p className="sr-only" aria-live="polite">
        {shown ? `${fullLabel(shown.t)}: ${shown.rate.toFixed(2)}` : ''}
      </p>

      <p className="mt-3 text-xs text-faint">
        High {max.toFixed(2)}, low {min.toFixed(2)}. This is the mid-market rate, which no provider
        gives you. It is the line they are all measured against.
      </p>
    </figure>
  )
}
