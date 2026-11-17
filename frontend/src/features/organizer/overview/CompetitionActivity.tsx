import { ChartNoAxesColumn, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { CompetitionActivity as Activity } from '../api/types'
import { formatCount, formatMonth } from '../format'

const SPANS = [6, 12] as const
type Span = (typeof SPANS)[number]

const PAD = { top: 14, right: 22, bottom: 30, left: 58 }
const HEIGHT = 196

/** Tracks an element's content width so the chart draws in real pixels (round markers, crisp lines). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** Ticks of 50 up to a ceiling that clears the data with a little headroom. */
function yTicks(max: number) {
  const top = Math.max(200, Math.ceil((max * 1.05) / 50) * 50)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += top > 300 ? 100 : 50) ticks.push(v)
  return { top, ticks }
}

export function CompetitionActivity({ activity }: { activity: Activity }) {
  const [span, setSpan] = useState<Span>(6)
  const [active, setActive] = useState<number | null>(null)
  const { ref, width } = useWidth<HTMLDivElement>()
  const selectId = useId()
  const tableId = useId()

  const points = activity.months.slice(-span)
  const change = activity.changePercent[span]
  const { top, ticks } = yTicks(Math.max(...points.map((p) => p.competitions)))

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH

  const coords = points.map((p, i) => `${x(i).toFixed(1)},${y(p.competitions).toFixed(1)}`)
  const line = `M${coords.join('L')}`
  const area = `${line}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`

  // Nearest month to the pointer: readers aim at a month, not at a 2px line.
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - box.left
    const i = Math.round(((px - PAD.left) / Math.max(plotW, 1)) * (points.length - 1))
    setActive(Math.min(points.length - 1, Math.max(0, i)))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : points.length)) + step)))
    } else if (event.key === 'Escape') setActive(null)
  }

  const first = points[0]
  const last = points[points.length - 1]
  const summary = `Competitions per month, ${formatMonth(first.month, true)} to ${formatMonth(last.month, true)}: from ${first.competitions} to ${last.competitions}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the previous ${span} months.`
  const tip = active === null ? null : points[active]

  return (
    <section className="org-card org-activity" aria-labelledby="org-activity-title">
      <header className="org-card__head">
        <ChartNoAxesColumn className="org-card__icon" size={26} strokeWidth={2.4} aria-hidden="true" />
        <h2 id="org-activity-title" className="org-card__title">
          Competition Activity
        </h2>
        <span className="org-period">
          <label htmlFor={selectId} className="visually-hidden">
            Period
          </label>
          <select
            id={selectId}
            value={span}
            onChange={(event) => {
              setSpan(Number(event.target.value) as Span)
              setActive(null)
            }}
          >
            {SPANS.map((w) => (
              <option key={w} value={w}>
                Last {w} Months
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </header>

      <div className="org-activity__plot" ref={ref}>
        <p className={`org-activity__badge${change < 0 ? ' is-down' : ''}`}>
          <strong>
            {change >= 0 ? '+' : '−'}
            {Math.abs(change)}%
          </strong>
          <span>vs. prior {span} months</span>
        </p>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={summary}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            <defs>
              <linearGradient id="org-activity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="org-activity__fill-top" />
                <stop offset="1" className="org-activity__fill-bottom" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line className="org-activity__grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
                <text className="org-activity__tick" x={PAD.left - 26} y={y(t)} dy="0.35em" textAnchor="end">
                  {formatCount(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => (
              <text key={p.month} className="org-activity__tick org-activity__tick--x" x={x(i)} y={HEIGHT - 8} textAnchor="middle">
                {span === 12 && i % 2 === 1 ? '' : formatMonth(p.month)}
              </text>
            ))}
            <path className="org-activity__area" d={area} fill="url(#org-activity-fill)" />
            <path className="org-activity__line" d={line} />
            {tip && <line className="org-activity__crosshair" x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={PAD.top + plotH} />}
            {points.map((p, i) => (
              <circle
                key={p.month}
                className={`org-activity__dot${i === active ? ' is-active' : ''}`}
                cx={x(i)}
                cy={y(p.competitions)}
                r={i === active ? 6 : 4.5}
              />
            ))}
          </svg>
        )}
        {tip && width > 0 && (
          <div
            className="org-activity__tooltip"
            role="status"
            style={{
              left: Math.min(Math.max(x(active!), 70), width - 70),
              top: Math.max(y(tip.competitions) - 58, 0),
            }}
          >
            <strong>{formatCount(tip.competitions)}</strong>
            <span>competitions · {formatMonth(tip.month, true)}</span>
          </div>
        )}
      </div>

      <table id={tableId} className="visually-hidden">
        <caption>Competitions per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Competitions</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{formatMonth(p.month, true)}</th>
              <td>{p.competitions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
