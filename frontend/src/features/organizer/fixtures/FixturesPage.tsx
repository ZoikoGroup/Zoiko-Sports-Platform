import { ArrowRight, CalendarCheck, CalendarDays, CalendarPlus, CircleAlert, CircleCheck, Clock, MapPin, TriangleAlert, Upload, X, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { describeError } from '../../../api/resource'
import { emptyFixtures } from '../api/empty'
import { organizerApi } from '../api/organizerApi'
import type { Fixture, FixtureSummary, FixturesData, RegionId, ScheduleConflict, SportId } from '../api/types'
import { useFixtures } from '../api/useOrganizerOverview'
import { EmptyMessage, Metric, NotConnectedNotice, ResourceView } from '../components/DataState'
import { Dialog } from '../components/Dialog'
import { SportThumb } from '../components/SportArt'
import { countryName } from '../countries'
import { formatLocalDateTime, localDay, REGION_LABELS, SPORT_LABELS } from '../format'
import { HeroBanner } from '../overview/HeroBanner'
import { useDocumentTitle, useOrganizerShell } from '../shellContext'
import { CreateFixtureDialog, type CompetitionOption } from './CreateFixtureDialog'
import { FixtureDrawer } from './FixtureDrawer'
import { ScheduleCalendar } from './ScheduleCalendar'
import { current, FIXTURE_STATUS_LABELS, fixtureStatus, type FixtureStatus } from './schedule'

const PERIODS = [
  { value: '7', label: 'Next 7 Days' },
  { value: '30', label: 'Next 30 Days' },
  { value: '90', label: 'Next 90 Days' },
  { value: 'all', label: 'All Upcoming' },
]
const PREVIEW_ROWS = 5

/** The design's four summary figures, in order; the values are organization totals from the server. */
const SUMMARY_CARDS: { key: keyof FixtureSummary; label: string; icon: LucideIcon; tone: string; testId: string }[] = [
  { key: 'total', label: 'Total Fixtures', icon: CalendarDays, tone: 'violet', testId: 'total' },
  { key: 'confirmed', label: 'Confirmed', icon: CircleCheck, tone: 'green', testId: 'confirmed' },
  { key: 'pendingReview', label: 'Pending Review', icon: CalendarCheck, tone: 'blue', testId: 'pending' },
  { key: 'conflicts', label: 'Schedule Conflicts', icon: TriangleAlert, tone: 'red', testId: 'conflicts' },
]

function SummaryCards({ summary }: { summary: FixtureSummary | null }) {
  return (
    <section className="org-solid-stats" aria-label="Fixture summary">
      {SUMMARY_CARDS.map(({ key, label, icon: IconComponent, tone, testId }) => (
        <article key={key} className={`org-solid-stat org-solid-stat--${tone}`} data-testid={`fx-stat-${testId}`}>
          <IconComponent size={48} strokeWidth={1.8} aria-hidden="true" />
          <p>
            <strong>
              <Metric value={summary?.[key]} />
            </strong>
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

function ConflictsCard({ conflicts, total, onReview, onViewAll }: { conflicts: ScheduleConflict[]; total: number | undefined; onReview: (fixtureId: string) => void; onViewAll: () => void }) {
  return (
    <section className="org-card org-conflicts" aria-labelledby="fx-conflicts-title">
      <header className="org-card__head">
        <TriangleAlert className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="fx-conflicts-title" className="org-card__title">
          Conflicts to Review
        </h2>
        {conflicts.length > 0 && (
          <button type="button" className="org-card__link org-card__link--button" onClick={onViewAll}>
            View all{total !== undefined && ` ${total}`} <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </header>
      {conflicts.length === 0 ? (
        <EmptyMessage>No open conflicts in your fixtures.</EmptyMessage>
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

interface FixturesViewProps {
  data: FixturesData
  /** Fetches the page data again after a change the server accepted. */
  refresh: () => Promise<FixturesData | null>
}

function FixturesView({ data, refresh }: FixturesViewProps) {
  const { region, setRegion } = useOrganizerShell()
  const [period, setPeriod] = useState('30')
  const [sport, setSport] = useState<SportId | 'all'>('all')
  const [day, setDay] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [info, setInfo] = useState<'import' | 'sync' | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [today] = useState(() => localDay(new Date().toISOString()))
  const [params, setParams] = useSearchParams()
  const now = useMemo(() => new Date(data.generatedAt), [data.generatedAt])
  const { fixtures } = data

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

  // Competitions offered by Create Fixture: those the fixture list covers, with their zone.
  const competitions: CompetitionOption[] = useMemo(() => {
    const byId = new Map<string, CompetitionOption>()
    for (const f of fixtures) if (!byId.has(f.competitionId)) byId.set(f.competitionId, { id: f.competitionId, name: f.competition, timeZone: f.timeZone })
    return [...byId.values()]
  }, [fixtures])

  const label = (f: Fixture) => `${f.home} vs. ${f.away}`

  /**
   * Sends one change to the server. On success the page shows the server's
   * updated data; on refusal it returns the reason for the panel to display.
   */
  async function change(action: () => Promise<unknown>, done: string, after?: (next: FixturesData | null) => void): Promise<string | null> {
    try {
      await action()
    } catch (failure) {
      return describeError(failure, "We couldn't save this change. Please try again.")
    }
    setAnnouncement(done)
    after?.(await refresh())
    return null
  }

  const visible = expanded ? rows : rows.slice(0, PREVIEW_ROWS)
  const scope = [
    day && `on ${new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    statusFilter && FIXTURE_STATUS_LABELS[statusFilter].toLowerCase(),
    competitionName,
  ].filter(Boolean)

  return (
    <div className="org-overview org-fx" data-testid="fixtures-page">
      <HeroBanner eyebrow="Customer Competition Workspace" title="Fixtures & Schedule" subtitle="Every fixture, every venue, every time zone — coordinated in one place." art="ball">
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

      <NotConnectedNotice />

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <div className="org-fx__layout">
        <div className="org-fx__main">
          <SummaryCards summary={data.summary} />

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

            {fixtures.length === 0 ? (
              <EmptyMessage>No fixtures yet. Use Create Fixture to add the first one.</EmptyMessage>
            ) : visible.length === 0 ? (
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
            conflicts={data.conflicts}
            total={data.summary?.conflicts}
            onReview={(id) => update({ fixture: id }, true)}
            onViewAll={() => {
              setDay(null)
              setPeriod('all')
              update({ status: 'conflict', approvals: null })
            }}
          />
        </aside>
      </div>

      <FixtureDrawer
        fixture={open}
        now={now}
        onClose={() => update({ fixture: null })}
        onPropose={(f, input) => change(() => organizerApi.proposeFixtureChange(f.id, input), `Change proposed for ${label(f)}.`)}
        onRequestApproval={(f) => change(() => organizerApi.requestFixtureApproval(f.id, f.change?.version ?? 0), `Approval requested for ${label(f)}.`)}
        onPublish={(f, input) => change(() => organizerApi.publishFixtureChange(f.id, input), `${label(f)} published. Recipients will be notified.`)}
        onDiscard={(f) =>
          change(() => organizerApi.discardFixtureChange(f.id), `Change to ${label(f)} discarded.`, (next) => {
            // A draft fixture the server removed has no details left to show.
            if (next && !next.fixtures.some((x) => x.id === f.id)) update({ fixture: null })
          })
        }
      />

      <CreateFixtureDialog
        open={creating}
        competitions={competitions}
        onClose={() => update({ new: null })}
        onCreate={async (input) => {
          await organizerApi.createFixture(input)
          setPeriod('all')
          setAnnouncement(`Draft fixture ${input.home} vs. ${input.away} created.`)
          update({ new: null })
          await refresh()
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

function FixturesSkeleton() {
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

/** Fixtures & Schedule — calendar and list, revisions, approval and publication. */
export function FixturesPage() {
  const state = useFixtures()
  useDocumentTitle('Fixtures & Schedule')

  return (
    <ResourceView resource={state} skeleton={<FixturesSkeleton />} errorTitle="We couldn't load your fixtures" empty={emptyFixtures}>
      {(data) => <FixturesView data={data} refresh={state.refresh} />}
    </ResourceView>
  )
}
