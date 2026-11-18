import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  CircleCheck,
  Clock,
  MapPin,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { USING_DEMO_DATA } from '../api/organizerApi'
import type { Fixture, FixturesData, RegionId, ScheduleConflict, SportId } from '../api/types'
import { useFixtures } from '../api/useOrganizerOverview'
import { Dialog } from '../components/Dialog'
import { SportThumb } from '../components/SportArt'
import { countryName } from '../countries'
import { formatCount, formatLocalDateTime, localDay, REGION_LABELS, SPORT_LABELS } from '../format'
import { useOrganizerIdentity } from '../layout/useWorkspaceSwitch'
import { HeroBanner } from '../overview/HeroBanner'
import { useDocumentTitle, useOrganizerShell } from '../shellContext'
import { CreateFixtureDialog, type CompetitionOption } from './CreateFixtureDialog'
import { FixtureDrawer } from './FixtureDrawer'
import { ScheduleCalendar } from './ScheduleCalendar'
import { current, discard, FIXTURE_STATUS_LABELS, fixtureStatus, proposeChange, publish, requestApproval, ScheduleError, type FixtureStatus } from './schedule'

const PERIODS = [
  { value: '7', label: 'Next 7 Days' },
  { value: '30', label: 'Next 30 Days' },
  { value: '90', label: 'Next 90 Days' },
  { value: 'all', label: 'All Upcoming' },
]
const PREVIEW_ROWS = 5

/** Run a scheduling rule; return its message if it refuses, null on success. */
function attempt(run: () => void): string | null {
  try {
    run()
    return null
  } catch (error) {
    if (error instanceof ScheduleError) return error.message
    throw error
  }
}

function SummaryCards({ cards }: { cards: { key: string; value: number; label: string; icon: LucideIcon; tone: string }[] }) {
  return (
    <section className="org-solid-stats" aria-label="Fixture summary">
      {cards.map(({ key, value, label, icon: IconComponent, tone }) => (
        <article key={key} className={`org-solid-stat org-solid-stat--${tone}`} data-testid={`fx-stat-${key}`}>
          <IconComponent size={48} strokeWidth={1.8} aria-hidden="true" />
          <p>
            <strong>{formatCount(value)}</strong>
            <span>{label}</span>
          </p>
        </article>
      ))}
    </section>
  )
}

function Select({ label, value, options, onChange, accent = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <span className={`org-field-select${accent ? ' org-field-select--accent' : ''}`}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}

function ConflictsCard({ conflicts, total, onReview, onViewAll }: { conflicts: ScheduleConflict[]; total: number; onReview: (fixtureId: string) => void; onViewAll: () => void }) {
  return (
    <section className="org-card org-conflicts" aria-labelledby="fx-conflicts-title">
      <header className="org-card__head">
        <TriangleAlert className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="fx-conflicts-title" className="org-card__title">
          Conflicts to Review
        </h2>
        <button type="button" className="org-card__link org-card__link--button" onClick={onViewAll}>
          View all {total} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </header>
      {conflicts.length === 0 ? (
        <p className="org-empty">No open conflicts in your fixtures.</p>
      ) : (
        <ul className="org-conflicts__list">
          {conflicts.map((c) => (
            <li key={c.id}>
              <span className={`org-conflicts__icon org-conflicts__icon--${c.kind}`} aria-hidden="true">
                {c.kind === 'venue' ? <TriangleAlert size={20} /> : <Clock size={20} />}
              </span>
              <span className="org-conflicts__text">
                <strong>{c.title}</strong>
                <span>{c.detail}</span>
              </span>
              <button type="button" className="org-card__link org-card__link--button" onClick={() => onReview(c.fixtureId)} aria-label={`Review: ${c.title}`}>
                Review
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FixturesView({ data }: { data: FixturesData }) {
  const { region, setRegion } = useOrganizerShell()
  const identity = useOrganizerIdentity()
  const [fixtures, setFixtures] = useState(data.fixtures)
  const [period, setPeriod] = useState('30')
  const [sport, setSport] = useState<SportId | 'all'>('all')
  const [day, setDay] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [info, setInfo] = useState<'import' | 'sync' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [today] = useState(() => localDay(new Date().toISOString()))
  const [params, setParams] = useSearchParams()
  const now = useMemo(() => new Date(data.generatedAt), [data.generatedAt])

  const openId = params.get('fixture')
  const creating = params.get('new') === 'fixture'
  const competitionId = params.get('competition')
  const statusFilter: FixtureStatus | null = params.get('approvals') ? 'pending' : (params.get('status') as FixtureStatus | null)
  const open = fixtures.find((f) => f.id === openId) ?? null

  const update = (changes: Record<string, string | null>, push = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: !push },
    )

  // Summary: organization totals adjusted by what changed on this page.
  const summary = useMemo(() => {
    const count = (list: Fixture[], s: FixtureStatus) => list.filter((f) => fixtureStatus(f) === s).length
    const delta = (s: FixtureStatus) => count(fixtures, s) - count(data.fixtures, s)
    return {
      total: data.summary.total + fixtures.length - data.fixtures.length,
      confirmed: data.summary.confirmed + delta('confirmed'),
      pending: data.summary.pendingReview + delta('pending') + delta('draft'),
      conflicts: data.summary.conflicts + delta('conflict'),
    }
  }, [fixtures, data])

  const sports = [...new Set(fixtures.map((f) => f.sport))]
  const competitionName = fixtures.find((f) => f.competitionId === competitionId)?.competition

  const rows = useMemo(() => {
    const from = now.getTime()
    const until = period === 'all' ? Infinity : from + Number(period) * 86_400_000
    return fixtures
      .filter((f) => sport === 'all' || f.sport === sport)
      .filter((f) => region === 'all' || f.region === region)
      .filter((f) => !competitionId || f.competitionId === competitionId)
      .filter((f) => !statusFilter || fixtureStatus(f) === statusFilter)
      .filter((f) => {
        const t = new Date(current(f).startsAt).getTime()
        if (day) return localDay(current(f).startsAt, f.timeZone) === day
        return t >= from && t <= until
      })
      .sort((a, b) => current(a).startsAt.localeCompare(current(b).startsAt))
  }, [fixtures, sport, region, competitionId, statusFilter, day, period, now])

  const marks = useMemo(() => {
    const map = new Map<string, { fixtures: number; key: boolean; event: boolean }>()
    for (const f of fixtures) {
      const d = localDay(current(f).startsAt, f.timeZone)
      const m = map.get(d) ?? { fixtures: 0, key: false, event: false }
      map.set(d, { ...m, fixtures: m.fixtures + 1, key: m.key || Boolean(f.key) })
    }
    for (const d of data.eventDays) map.set(d, { ...(map.get(d) ?? { fixtures: 0, key: false }), event: true })
    return map
  }, [fixtures, data.eventDays])

  const competitions: CompetitionOption[] = useMemo(() => {
    const byId = new Map<string, CompetitionOption>()
    for (const f of fixtures) if (!byId.has(f.competitionId) && f.revisions.length) byId.set(f.competitionId, { id: f.competitionId, name: f.competition, template: f })
    return [...byId.values()]
  }, [fixtures])

  const replace = (next: Fixture) => setFixtures((list) => list.map((f) => (f.id === next.id ? next : f)))
  const label = (f: Fixture) => `${f.home} vs. ${f.away}`

  const visible = expanded ? rows : rows.slice(0, PREVIEW_ROWS)
  const scope = [
    day && `on ${new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    statusFilter && FIXTURE_STATUS_LABELS[statusFilter].toLowerCase(),
    competitionName,
  ].filter(Boolean)

  return (
    <div className="org-overview org-fx" data-testid="fixtures-page">
      <HeroBanner eyebrow={data.hero.eyebrow} title={data.hero.title} subtitle={data.hero.subtitle} art="ball">
        <Link className="org-btn org-btn--primary" to="?new=fixture">
          <CalendarPlus size={22} aria-hidden="true" />
          Create Fixture
        </Link>
        <button type="button" className="org-btn org-btn--ghost" onClick={() => setInfo('import')}>
          <Upload size={22} aria-hidden="true" />
          Import Schedule
        </button>
        <button type="button" className="org-btn org-btn--ghost" onClick={() => setInfo('sync')}>
          <CalendarDays size={22} aria-hidden="true" />
          Sync Calendar
        </button>
      </HeroBanner>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <div className="org-fx__layout">
        <div className="org-fx__main">
          <SummaryCards
            cards={[
              { key: 'total', value: summary.total, label: 'Total Fixtures', icon: CalendarDays, tone: 'violet' },
              { key: 'confirmed', value: summary.confirmed, label: 'Confirmed', icon: CircleCheck, tone: 'green' },
              { key: 'pending', value: summary.pending, label: 'Pending Review', icon: CalendarCheck, tone: 'blue' },
              { key: 'conflicts', value: summary.conflicts, label: 'Schedule Conflicts', icon: TriangleAlert, tone: 'red' },
            ]}
          />

          <section className="org-card org-fixtures" aria-labelledby="fx-list-title">
            <header className="org-card__head">
              <CalendarDays className="org-card__icon" size={28} aria-hidden="true" />
              <h2 id="fx-list-title" className="org-card__title">
                Upcoming Fixtures
              </h2>
              {rows.length > PREVIEW_ROWS && (
                <button type="button" className="org-card__link org-card__link--button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? 'Show fewer' : 'View full schedule'} <ArrowRight size={18} aria-hidden="true" className={expanded ? 'is-up' : undefined} />
                </button>
              )}
            </header>

            <div className="org-fixtures__filters" role="group" aria-label="Filter fixtures">
              <Select label="Period" value={period} options={PERIODS} onChange={(v) => { setPeriod(v); setDay(null) }} accent />
              <Select label="Sport" value={sport} options={[{ value: 'all', label: 'All Sports' }, ...sports.map((s) => ({ value: s, label: SPORT_LABELS[s] }))]} onChange={(v) => setSport(v as SportId | 'all')} />
              <Select
                label="Region"
                value={region}
                options={[{ value: 'all', label: 'All Regions' }, ...(Object.keys(REGION_LABELS) as RegionId[]).map((r) => ({ value: r, label: REGION_LABELS[r] }))]}
                onChange={(v) => setRegion(v as RegionId | 'all')}
              />
              {scope.length > 0 && (
                <button
                  type="button"
                  className="org-chip"
                  onClick={() => {
                    setDay(null)
                    update({ status: null, approvals: null, competition: null, action: null })
                  }}
                >
                  Showing {scope.join(' · ')} <X size={16} aria-hidden="true" />
                  <span className="visually-hidden">— clear</span>
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="org-empty">
                <p>No fixtures match these filters.</p>
              </div>
            ) : (
              <div className="org-fixtures__scroll">
                <table className="org-table org-fixtures__table">
                  <caption className="visually-hidden">Upcoming fixtures</caption>
                  <thead>
                    <tr>
                      <th scope="col">Local Date / Time</th>
                      <th scope="col">Fixture / Competition</th>
                      <th scope="col">Host Venue</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((f) => {
                      const { date, time } = formatLocalDateTime(current(f).startsAt, f.timeZone)
                      const status = fixtureStatus(f)
                      return (
                        <tr key={f.id} data-testid="fixture-row" className={`org-fixtures__row org-fixtures__row--${f.sport}`}>
                          <td className="org-fixtures__when">
                            <strong>{date}</strong>
                            <span>{time}</span>
                          </td>
                          <th scope="row" className="org-fixtures__match">
                            <SportThumb sport={f.sport} className="org-table__thumb" />
                            <span>
                              <button type="button" className="org-table__link" onClick={() => update({ fixture: f.id }, true)}>
                                {label(f)}
                              </button>
                              <span>{f.competition}</span>
                            </span>
                          </th>
                          <td>
                            <span className="org-table__country">
                              <MapPin size={18} aria-hidden="true" />
                              {f.city}, {countryName(f.country) === 'United States' ? 'USA' : countryName(f.country)}
                            </span>
                          </td>
                          <td>
                            <span className={`org-status org-status--fx-${status}`}>{FIXTURE_STATUS_LABELS[status]}</span>
                          </td>
                          <td className="org-table__go">
                            <button type="button" className="org-fixtures__go" aria-label={`Open ${label(f)}`} onClick={() => update({ fixture: f.id }, true)}>
                              <ArrowRight size={20} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="org-fx__side" aria-label="Calendar and conflicts">
          <ScheduleCalendar
            marks={marks}
            today={today}
            selected={day}
            onSelect={(d) => {
              setDay(d)
              setExpanded(true)
            }}
          />
          <ConflictsCard
            conflicts={data.conflicts.filter((c) => fixtures.some((f) => f.id === c.fixtureId && f.conflict))}
            total={summary.conflicts}
            onReview={(id) => update({ fixture: id }, true)}
            onViewAll={() => {
              setDay(null)
              setPeriod('all')
              update({ status: 'conflict', approvals: null })
            }}
          />
        </aside>
      </div>

      {USING_DEMO_DATA && <p className="org-footnote">Sample data is illustrative and not from a live competition.</p>}

      <FixtureDrawer
        fixture={open}
        role={identity.role}
        now={now}
        onClose={() => update({ fixture: null })}
        onPropose={(f, input) =>
          attempt(() => {
            replace(proposeChange(f, input, identity.name))
            setAnnouncement(`Change proposed for ${label(f)}.`)
          })
        }
        onRequestApproval={(f) =>
          attempt(() => {
            replace(requestApproval(f))
            setAnnouncement(`Approval requested for ${label(f)}.`)
          })
        }
        onPublish={(f, input) =>
          attempt(() => {
            const next = publish(f, { ...input, role: identity.role, author: identity.name })
            replace(next)
            setAnnouncement(`${label(f)} published as version ${next.revisions[0].version}. Recipients will be notified.`)
          })
        }
        onDiscard={(f) => {
          const next = discard(f)
          if (next) replace(next)
          else {
            setFixtures((list) => list.filter((x) => x.id !== f.id))
            update({ fixture: null })
          }
          setAnnouncement(next ? `Change to ${label(f)} discarded.` : `Draft fixture ${label(f)} discarded.`)
        }}
      />

      <CreateFixtureDialog
        open={creating}
        competitions={competitions}
        onClose={() => update({ new: null })}
        onCreate={(input) => {
          const template = competitions.find((c) => c.id === input.competitionId)!.template
          const created: Fixture = {
            id: `fx-new-${Date.now()}`,
            competitionId: template.competitionId,
            competition: template.competition,
            sport: template.sport,
            home: input.home,
            away: input.away,
            city: template.city,
            country: template.country,
            region: template.region,
            timeZone: template.timeZone,
            revisions: [],
            change: { version: 1, baseVersion: 0, startsAt: input.startsAt, venue: input.venue, reason: 'New fixture.', author: identity.name, proposedAt: new Date().toISOString(), state: 'proposed' },
            recipients: [
              { role: 'Home club', name: input.home },
              { role: 'Away club', name: input.away },
              ...template.recipients.filter((r) => r.role === 'Venue' || r.role === 'Officials'),
            ],
          }
          setFixtures((list) => [...list, created])
          setPeriod('all')
          setAnnouncement(`Draft fixture ${input.home} vs. ${input.away} created.`)
          update({ new: null, fixture: created.id })
        }}
      />

      <Dialog open={info !== null} onClose={() => setInfo(null)} labelledBy="fx-info-title">
        <div className="org-form">
          <header className="org-form__head">
            <h2 id="fx-info-title">{info === 'import' ? 'Import Schedule' : 'Sync Calendar'}</h2>
            <button type="button" className="org-icon-button" onClick={() => setInfo(null)} aria-label="Close">
              <X size={22} aria-hidden="true" />
            </button>
          </header>
          <p className="org-info">
            <CircleAlert size={22} aria-hidden="true" />
            {info === 'import'
              ? "Importing a schedule file isn't available yet. Create fixtures one at a time with Create Fixture."
              : "Calendar sync isn't available yet. Published fixtures appear here as soon as they're approved."}
          </p>
          <footer className="org-form__actions">
            <button type="button" className="org-btn org-btn--secondary" onClick={() => setInfo(null)}>
              Close
            </button>
          </footer>
        </div>
      </Dialog>
    </div>
  )
}

/** Fixtures & Schedule — calendar and list, revisions, approval and publication. */
export function FixturesPage() {
  const state = useFixtures()
  useDocumentTitle('Fixtures & Schedule')

  if (state.status === 'loading') {
    return (
      <div className="org-overview" aria-busy="true">
        <span role="status" className="visually-hidden">
          Loading fixtures
        </span>
        <div className="org-skeleton org-skeleton--hero" />
        <div className="org-fx__layout">
          <div className="org-skeleton org-skeleton--card-lg" />
          <div className="org-skeleton org-skeleton--card-lg" />
        </div>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="org-overview">
        <div className="org-card org-error" role="alert">
          <CircleAlert size={28} aria-hidden="true" />
          <div>
            <h1 className="org-card__title">We couldn't load your fixtures</h1>
            <p>{state.error}</p>
          </div>
          <button type="button" className="org-btn org-btn--secondary" onClick={state.reload}>
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }
  return <FixturesView data={state.data} />
}
