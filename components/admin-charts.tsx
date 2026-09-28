'use client'

import { useState } from 'react'

/**
 * Small single-series charts for the admin, in plain HTML: one hue (the
 * site's bar green, which follows the theme), thin marks with 4px rounded
 * data ends and 2px gaps, a recessive grid, and a tooltip on every mark.
 * Each also renders a visually hidden table, so the numbers are never
 * locked inside the picture.
 */

export interface ChartPoint {
  key: string
  /** Axis label, e.g. "28 Sep". */
  label: string
  value: number
  /** Tooltip line under the value, e.g. "Monday". */
  detail?: string
}

/** Named, not a function: server pages render these charts. */
export type ChartFormat = 'number' | 'pkr-short'

const FORMATS: Record<ChartFormat, (value: number) => string> = {
  number: (value) => value.toLocaleString('en-GB'),
  'pkr-short': (value) =>
    value >= 1000 ? `₨${Math.round(value / 100) / 10}k` : `₨${Math.round(value).toLocaleString('en-GB')}`,
}

/** A round top for the axis: 1, 2 or 5 × a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((n) => n * power >= value) ?? 10
  return step * power
}

export function ColumnChart({
  data,
  caption,
  unit,
  formatAs = 'number',
  height = 190,
}: {
  data: ChartPoint[]
  /** Names the chart for screen readers and the hidden table. */
  caption: string
  /** Word after the value in the tooltip, e.g. "clicks". */
  unit?: string
  formatAs?: ChartFormat
  height?: number
}) {
  const format = FORMATS[formatAs]
  const [hover, setHover] = useState<number | null>(null)
  if (data.every((point) => point.value === 0)) {
    return (
      <p className="grid place-items-center rounded-[12px] bg-mist text-[14px] text-muted" style={{ height }}>
        Nothing recorded in this period yet.
      </p>
    )
  }
  const top = niceMax(Math.max(0, ...data.map((point) => point.value)))
  const ticks = [top, top / 2, 0]
  // Every label on a short series; every other one past ten, so none collide.
  const labelEvery = data.length > 10 ? 2 : 1

  return (
    <figure className="m-0">
      <div className="flex gap-3">
        {/* Y axis */}
        <div className="relative w-9 shrink-0 text-end text-[11.5px] text-faint tabular-nums" style={{ height }} aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={tick} className="absolute end-0 -translate-y-1/2" style={{ top: `${(index / 2) * 100}%` }}>
              {format(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden="true">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className={`absolute inset-x-0 h-px ${index === 2 ? 'bg-line' : 'bg-line-2'}`}
                style={{ top: `${(index / 2) * 100}%` }}
              />
            ))}
          </div>

          {/* Columns: the whole column height is the hover target. */}
          <div className="relative flex gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)} aria-hidden="true">
            {data.map((point, index) => {
              const share = point.value / top
              const active = hover === index
              return (
                <div
                  key={point.key}
                  className="relative flex h-full flex-1 cursor-default items-end"
                  onMouseEnter={() => setHover(index)}
                >
                  <span
                    className="block w-full rounded-t-[4px] transition-[background-color,height] duration-300"
                    style={{
                      height: point.value > 0 ? `max(${share * 100}%, 3px)` : 0,
                      background: active ? 'var(--color-brand)' : 'var(--color-bar)',
                      opacity: hover === null || active ? 1 : 0.55,
                    }}
                  />
                  {active && (
                    <span
                      className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-[10px] bg-ink px-3 py-2 text-center whitespace-nowrap text-surface shadow-lg"
                      // Just above the bar's top, wherever that is.
                      style={{ bottom: `calc(${share * 100}% + 8px)` }}
                    >
                      <span className="block text-[14px] font-bold tabular-nums">
                        {format(point.value)}
                        {unit ? ` ${unit}` : ''}
                      </span>
                      <span className="block text-[12px] opacity-75">{point.detail ?? point.label}</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* X axis */}
          <div className="mt-2 flex gap-[2px] text-[11.5px] text-faint" aria-hidden="true">
            {data.map((point, index) => (
              <span key={point.key} className="flex-1 truncate text-center">
                {index % labelEvery === 0 ? point.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.detail ?? point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Ranked horizontal bars, value labelled at each bar's end. */
export function BarList({
  data,
  caption,
  unit,
}: {
  data: { key: string; label: string; value: number }[]
  caption: string
  unit?: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((row) => row.value))
  const total = data.reduce((sum, row) => sum + row.value, 0)

  return (
    <figure className="m-0">
      <ul className="grid gap-2.5" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {data.map((row) => {
          const active = hover === row.key
          return (
            <li
              key={row.key}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[13.5px]"
              onMouseEnter={() => setHover(row.key)}
            >
              <span className={`truncate ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>{row.label}</span>
              <span className="relative h-6">
                <span
                  className="absolute inset-y-0 start-0 rounded-e-[4px] transition-[width,background-color] duration-300"
                  style={{
                    width: `max(${(row.value / max) * 100}%, 3px)`,
                    background: active ? 'var(--color-brand)' : 'var(--color-bar)',
                    opacity: hover === null || active ? 1 : 0.55,
                  }}
                />
                {active && (
                  <span className="pointer-events-none absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-[8px] bg-ink px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-surface shadow-lg">
                    {Math.round((row.value / Math.max(total, 1)) * 100)}% of {unit ?? 'total'}
                  </span>
                )}
              </span>
              <span className="text-end font-semibold text-ink tabular-nums">{row.value.toLocaleString('en-GB')}</span>
            </li>
          )
        })}
      </ul>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Seven tiny bars for a stat tile. Decorative: the tile states the number. */
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <span className="flex h-8 items-end gap-[3px]" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          className="w-[6px] rounded-t-[2px]"
          style={{
            height: `${Math.max((value / max) * 100, 8)}%`,
            background: index === values.length - 1 ? 'var(--color-brand)' : 'var(--color-bar)',
            opacity: index === values.length - 1 ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  )
}
