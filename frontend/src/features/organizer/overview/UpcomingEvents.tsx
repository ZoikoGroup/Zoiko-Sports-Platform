import { ArrowRight, CalendarDays, Check, ChevronDown, Ellipsis, Hourglass, MapPin, Play } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { EventStatus, RegionId, SportId, UpcomingEvent } from '../api/types'
import { Menu } from '../components/Menu'
import { SportIcon, SportThumb } from '../components/SportArt'
import { formatEventStart, REGION_LABELS, SPORT_LABELS, STATUS_LABELS } from '../format'
import { organizerPath } from '../navigation'

const RANGES = [
  { days: 7, label: 'Next 7 Days' },
  { days: 30, label: 'Next 30 Days' },
  { days: 90, label: 'Next 90 Days' },
]

/** Rows shown on the overview; the full list lives in Competitions & Events. */
const VISIBLE_ROWS = 4

const STATUS_ICON: Record<EventStatus, ReactNode> = {
  ready: <Check size={18} strokeWidth={2.6} aria-hidden="true" />,
  'in-progress': <Play size={15} strokeWidth={2.4} aria-hidden="true" />,
  preparing: <Hourglass size={16} strokeWidth={2.2} aria-hidden="true" />,
  scheduled: <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />,
}

export function StatusChip({ status }: { status: EventStatus }) {
  return (
    <span className={`org-status org-status--${status}`}>
      {STATUS_ICON[status]}
      {STATUS_LABELS[status]}
    </span>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <span className="org-filter">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="org-filter__chevron" size={18} aria-hidden="true" />
    </span>
  )
}

interface UpcomingEventsProps {
  events: UpcomingEvent[]
  generatedAt: string
  region: RegionId | 'all'
  onRegionChange: (region: RegionId | 'all') => void
}

export function UpcomingEvents({ events, generatedAt, region, onRegionChange }: UpcomingEventsProps) {
  const [sport, setSport] = useState<SportId | 'all'>('all')
  const [days, setDays] = useState('30')

  const sports = useMemo(() => [...new Set(events.map((e) => e.sport))], [events])

  const matching = useMemo(() => {
    const now = new Date(generatedAt).getTime()
    const until = now + Number(days) * 86_400_000
    return events
      .filter((e) => sport === 'all' || e.sport === sport)
      .filter((e) => region === 'all' || e.region === region)
      .filter((e) => {
        const start = new Date(e.startsAt).getTime()
        return e.status === 'in-progress' || (start >= now && start <= until)
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [events, generatedAt, sport, region, days])

  const rows = matching.slice(0, VISIBLE_ROWS)
  const filtered = sport !== 'all' || region !== 'all'

  return (
    <section className="org-card org-events" aria-labelledby="org-events-title">
      <header className="org-card__head">
        <CalendarDays className="org-card__icon" size={30} aria-hidden="true" />
        <h2 id="org-events-title" className="org-card__title">
          Upcoming Events &amp; Fixtures
        </h2>
        <Link className="org-card__link" to={organizerPath('competitions')}>
          View All Events <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </header>

      <div className="org-events__filters" role="group" aria-label="Filter upcoming events">
        <FilterSelect
          label="Sport"
          value={sport}
          onChange={setSport}
          options={[{ value: 'all', label: 'All Sports' }, ...sports.map((s) => ({ value: s, label: SPORT_LABELS[s] }))]}
        />
        <FilterSelect
          label="Region"
          value={region}
          onChange={onRegionChange}
          options={[
            { value: 'all', label: 'All Regions' },
            ...(Object.keys(REGION_LABELS) as RegionId[]).map((r) => ({ value: r, label: REGION_LABELS[r] })),
          ]}
        />
        <FilterSelect label="Date range" value={days} onChange={setDays} options={RANGES.map((r) => ({ value: String(r.days), label: r.label }))} />
      </div>

      {rows.length === 0 ? (
        <div className="org-empty">
          <p>No events match these filters in this period.</p>
          {filtered && (
            <button
              type="button"
              className="org-btn org-btn--secondary"
              onClick={() => {
                setSport('all')
                onRegionChange('all')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="org-events__list" aria-label="Upcoming events">
          {rows.map((event) => {
            const when = formatEventStart(event.startsAt, event.timeZone)
            return (
            <li key={event.id} className="org-event" data-testid="upcoming-event">
              <SportThumb sport={event.sport} className="org-event__thumb" />
              <Link className="org-event__name" to={`${organizerPath('competitions')}?event=${event.id}`}>
                {event.name}
              </Link>
              <div className="org-event__details">
                <span className="org-event__meta org-event__sport">
                  <SportIcon sport={event.sport} size={20} />
                  {SPORT_LABELS[event.sport]}
                </span>
                <span className="org-event__meta org-event__place">
                  <MapPin size={20} aria-hidden="true" />
                  <span>
                    {event.city},<br /> {event.country}
                  </span>
                </span>
                <span className="org-event__meta org-event__when">
                  <CalendarDays size={20} aria-hidden="true" />
                  <time dateTime={event.startsAt}>
                    <span>{when.date}</span> <span>{when.time}</span>
                  </time>
                </span>
              </div>
              <StatusChip status={event.status} />
              <Menu
                label={`Actions for ${event.name}`}
                align="end"
                triggerClassName="org-event__more"
                trigger={<Ellipsis size={22} aria-hidden="true" />}
              >
                {(close) => (
                  <>
                    <Link role="menuitem" className="org-menu__item" to={`${organizerPath('competitions')}?event=${event.id}`} onClick={close}>
                      View event
                    </Link>
                    <Link role="menuitem" className="org-menu__item" to={`${organizerPath('fixtures')}?event=${event.id}`} onClick={close}>
                      Fixtures &amp; schedule
                    </Link>
                    <Link role="menuitem" className="org-menu__item" to={`${organizerPath('venues')}?event=${event.id}`} onClick={close}>
                      Venue readiness
                    </Link>
                  </>
                )}
              </Menu>
            </li>
            )
          })}
        </ul>
      )}

      {matching.length > rows.length && (
        <p className="org-events__more">
          Showing {rows.length} of {matching.length} events in this period.{' '}
          <Link to={organizerPath('competitions')}>See all</Link>
        </p>
      )}
    </section>
  )
}
