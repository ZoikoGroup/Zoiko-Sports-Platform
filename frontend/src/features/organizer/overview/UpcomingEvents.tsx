import { ArrowRight, CalendarDays, Check, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EventStatus, RegionId, SportId, UpcomingEvent } from '../api/types'
import { Menu } from '../components/Menu'
import { SportThumb } from '../components/SportArt'
import { formatEventRange, REGION_LABELS, SPORT_LABELS, STATUS_LABELS } from '../format'
import { organizerPath } from '../navigation'

const PERIODS = [
  { days: 7, label: 'Next 7 days' },
  { days: 30, label: 'Next 30 days' },
  { days: 90, label: 'Next 90 days' },
]
const DEFAULT_DAYS = 30

/** Rows shown on the overview; the full list lives in Competitions & Events. */
const VISIBLE_ROWS = 4

export function StatusChip({ status }: { status: EventStatus }) {
  return <span className={`org-status org-status--${status}`}>{STATUS_LABELS[status]}</span>
}

interface UpcomingEventsProps {
  events: UpcomingEvent[]
  generatedAt: string
  /** Region scope from the top bar. */
  region: RegionId | 'all'
  onRegionChange: (region: RegionId | 'all') => void
}

export function UpcomingEvents({ events, generatedAt, region, onRegionChange }: UpcomingEventsProps) {
  const [sport, setSport] = useState<SportId | 'all'>('all')
  const [days, setDays] = useState(DEFAULT_DAYS)

  const sports = useMemo(() => [...new Set(events.map((e) => e.sport))], [events])

  const rows = useMemo(() => {
    const now = new Date(generatedAt).getTime()
    const until = now + days * 86_400_000
    return events
      .filter((e) => sport === 'all' || e.sport === sport)
      .filter((e) => region === 'all' || e.region === region)
      .filter((e) => {
        const start = new Date(e.startsAt).getTime()
        const end = new Date(e.endsAt).getTime()
        return end >= now && start <= until
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, VISIBLE_ROWS)
  }, [events, generatedAt, sport, region, days])

  const filtered = sport !== 'all' || days !== DEFAULT_DAYS
  const scope = [
    sport === 'all' ? null : SPORT_LABELS[sport],
    region === 'all' ? null : REGION_LABELS[region],
    PERIODS.find((p) => p.days === days)?.label,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="org-card org-events" aria-labelledby="org-events-title">
      <header className="org-card__head">
        <CalendarDays className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="org-events-title" className="org-card__title">
          Upcoming Events &amp; Fixtures
        </h2>
        <Menu
          label={`Filter events: ${scope}`}
          align="end"
          triggerClassName={`org-card__tool${filtered ? ' is-active' : ''}`}
          trigger={<SlidersHorizontal size={18} aria-hidden="true" />}
        >
          {(close) => (
            <>
              <p className="org-menu__heading">Sport</p>
              {(['all', ...sports] as (SportId | 'all')[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sport === value}
                  className="org-menu__item"
                  onClick={() => {
                    setSport(value)
                    close()
                  }}
                >
                  <span className="org-menu__item-text">{value === 'all' ? 'All sports' : SPORT_LABELS[value]}</span>
                  {sport === value && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
              <p className="org-menu__heading">Period</p>
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  role="menuitemradio"
                  aria-checked={days === p.days}
                  className="org-menu__item"
                  onClick={() => {
                    setDays(p.days)
                    close()
                  }}
                >
                  <span className="org-menu__item-text">{p.label}</span>
                  {days === p.days && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
            </>
          )}
        </Menu>
        <Link className="org-card__link" to={organizerPath('competitions')}>
          View All <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="org-empty">
          <p>No events match {scope}.</p>
          {(filtered || region !== 'all') && (
            <button
              type="button"
              className="org-btn org-btn--secondary"
              onClick={() => {
                setSport('all')
                setDays(DEFAULT_DAYS)
                onRegionChange('all')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="org-events__list" aria-label="Upcoming events">
          {rows.map((event) => (
            <li key={event.id} className="org-event" data-testid="upcoming-event">
              <SportThumb sport={event.sport} className="org-event__thumb" />
              <Link className="org-event__name" to={`${organizerPath('competitions')}?event=${event.id}`}>
                {event.name}
              </Link>
              <span className="org-event__sport">{SPORT_LABELS[event.sport]}</span>
              <span className="org-event__when">
                <CalendarDays size={16} aria-hidden="true" />
                <time dateTime={event.startsAt}>{formatEventRange(event.startsAt, event.endsAt, event.timeZone)}</time>
              </span>
              <StatusChip status={event.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
