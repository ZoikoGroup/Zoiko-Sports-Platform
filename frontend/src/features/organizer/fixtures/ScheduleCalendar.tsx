import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DayMarks {
  fixtures: number
  key: boolean
  event: boolean
}

interface ScheduleCalendarProps {
  /** YYYY-MM-DD → what happens that day (fixture local dates). */
  marks: Map<string, DayMarks>
  /** Today in the viewer's zone, YYYY-MM-DD. */
  today: string
  selected: string | null
  onSelect: (day: string | null) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Month grid; a day with fixtures can be chosen to filter the list (choose again to clear). */
export function ScheduleCalendar({ marks, today, selected, onSelect }: ScheduleCalendarProps) {
  const [month, setMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { y, m: m - 1 }
  })

  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1).getDay()
    const days = new Date(month.y, month.m + 1, 0).getDate()
    return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month.y}-${pad(month.m + 1)}-${pad(i + 1)}`)]
  }, [month])

  const title = new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const step = (delta: number) => setMonth(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }))

  return (
    <section className="org-card org-calendar" aria-labelledby="fx-calendar-title">
      <header className="org-card__head">
        <CalendarDays className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="fx-calendar-title" className="org-card__title">
          Schedule Calendar
        </h2>
        <div className="org-calendar__nav">
          <button type="button" className="org-icon-button org-icon-button--sm" aria-label="Previous month" onClick={() => step(-1)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">{title}</span>
          <button type="button" className="org-icon-button org-icon-button--sm" aria-label="Next month" onClick={() => step(1)}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="org-calendar__grid" role="grid" aria-label={title}>
        <div className="org-calendar__row" role="row">
          {WEEKDAYS.map((d) => (
            <span key={d} className="org-calendar__weekday" role="columnheader">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
          <div key={row} className="org-calendar__row" role="row">
            {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
              if (!day) return <span key={`blank-${i}`} role="gridcell" />
              const mark = marks.get(day)
              const n = Number(day.slice(8))
              const label = [
                new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
                mark?.fixtures ? `${mark.fixtures} fixture${mark.fixtures > 1 ? 's' : ''}` : null,
                mark?.key ? 'key match' : null,
                mark?.event ? 'competition starts' : null,
                day === today ? 'today' : null,
              ]
                .filter(Boolean)
                .join(', ')
              const classes = [
                'org-calendar__day',
                mark?.fixtures && 'has-fixtures',
                day === today && 'is-today',
                day === selected && 'is-selected',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <span key={day} role="gridcell">
                  <button
                    type="button"
                    className={classes}
                    aria-label={label}
                    aria-pressed={day === selected}
                    disabled={!mark?.fixtures}
                    onClick={() => onSelect(day === selected ? null : day)}
                    data-day={day}
                  >
                    {n}
                    <span className="org-calendar__dots" aria-hidden="true">
                      {mark?.fixtures ? <i className="is-fixture" /> : null}
                      {mark?.event ? <i className="is-event" /> : null}
                      {mark?.key ? <i className="is-key" /> : null}
                    </span>
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <ul className="org-calendar__legend" aria-label="Legend">
        <li>
          <i className="is-fixture" aria-hidden="true" /> Fixtures
        </li>
        <li>
          <i className="is-event" aria-hidden="true" /> Events
        </li>
        <li>
          <i className="is-key" aria-hidden="true" /> Key Matches
        </li>
      </ul>
    </section>
  )
}
