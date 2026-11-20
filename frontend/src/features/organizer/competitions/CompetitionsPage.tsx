import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  CirclePlus,
  ClipboardCheck,
  Clock,
  ListChecks,
  Rss,
  TriangleAlert,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StadiumIcon } from '../../../components/icons'
import { emptyCompetitions } from '../api/empty'
import { organizerApi } from '../api/organizerApi'
import type { AttentionItem, CompetitionEvent, CompetitionsData, NewCompetition, NewCompetitionEvent, RecentUpdate } from '../api/types'
import { useCompetitions } from '../api/useOrganizerOverview'
import { useAvailability, useKnown } from '../components/availability'
import { EmptyMessage, Metric, NotConnectedNotice, ResourceView } from '../components/DataState'
import { formatAgo } from '../format'
import { organizerPath } from '../navigation'
import { HeroBanner } from '../overview/HeroBanner'
import { useDocumentTitle, useOrganizerShell } from '../shellContext'
import { CompetitionDirectory } from './CompetitionDirectory'
import { CompetitionDrawer } from './CompetitionDrawer'
import { CreateCompetitionDialog, CreateEventDialog } from './CreateDialogs'

type Icon = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

const ATTENTION_ICONS: Record<AttentionItem['kind'], Icon> = {
  schedule: CalendarCheck,
  venue: StadiumIcon,
  participation: UserPlus,
}

function StatCards({ stats }: { stats: { key: string; value: number | null; label: string; icon: Icon; tone: string }[] }) {
  return (
    <section className="org-stats" aria-label="Competition summary">
      {stats.map(({ key, value, label, icon: IconComponent, tone }) => (
        <article key={key} className={`org-stat org-stat--${tone}`} data-testid={`stat-${key}`}>
          <IconComponent className="org-stat__icon" size={52} strokeWidth={1.7} aria-hidden="true" />
          <span className="org-stat__rule" aria-hidden="true" />
          <p className="org-stat__body">
            <strong>
              <Metric value={value} />
            </strong>
            <span>{label}</span>
          </p>
        </article>
      ))}
    </section>
  )
}

function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const total = useKnown(items.reduce((sum, item) => sum + item.count, 0))
  return (
    <section className="org-card org-attention" aria-labelledby="cmp-attention-title">
      <header className="org-card__head">
        <TriangleAlert className="org-card__icon" size={30} aria-hidden="true" />
        <h2 id="cmp-attention-title" className="org-card__title">
          Needs Attention
        </h2>
        {total !== null && (
          <span className="org-attention__count" aria-label={`${total} items`}>
            {total}
          </span>
        )}
      </header>
      {items.length === 0 ? (
        <EmptyMessage>Nothing needs your attention.</EmptyMessage>
      ) : (
        <ul className="org-attention__list">
          {items.map((item) => {
            const IconComponent = ATTENTION_ICONS[item.kind]
            return (
              <li key={item.id}>
                <IconComponent className="org-attention__icon" size={36} strokeWidth={1.7} />
                <span className="org-attention__text">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <Link className="org-card__link" to={organizerPath(item.module)} aria-label={`${item.cta}: ${item.title}`}>
                  {item.cta} <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PlanningSummary({ events }: { events: CompetitionEvent[] }) {
  const live = useAvailability() === 'live'
  const count = (status?: CompetitionEvent['status']) =>
    live ? (status ? events.filter((e) => e.status === status).length : events.length) : null
  const stats: { key: string; value: number | null; label: string; icon: Icon; tone: string }[] = [
    { key: 'total', value: count(), label: 'Total Events', icon: ListChecks, tone: 'violet' },
    { key: 'confirmed', value: count('confirmed'), label: 'Confirmed', icon: CalendarCheck, tone: 'green' },
    { key: 'planning', value: count('planning'), label: 'In Planning', icon: CalendarDays, tone: 'blue' },
    { key: 'draft', value: count('draft'), label: 'Draft', icon: Clock, tone: 'orange' },
  ]
  return (
    <section className="org-card org-planning" aria-labelledby="cmp-planning-title">
      <header className="org-card__head">
        <CalendarDays className="org-card__icon" size={28} aria-hidden="true" />
        <h2 id="cmp-planning-title" className="org-card__title">
          Event Planning Summary
        </h2>
      </header>
      <dl className="org-planning__stats">
        {stats.map(({ key, value, label, icon: IconComponent, tone }) => (
          <div key={key} className={`org-planning__stat org-planning__stat--${tone}`} data-testid={`planning-${key}`}>
            <IconComponent size={36} strokeWidth={1.8} aria-hidden="true" />
            <dt>{label}</dt>
            <dd>
              <Metric value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RecentUpdateCard({ items, now }: { items: RecentUpdate[]; now: Date }) {
  return (
    <section className="org-card org-cmp-updates" aria-labelledby="cmp-updates-title">
      <header className="org-card__head">
        <Rss className="org-card__icon" size={26} strokeWidth={2.4} aria-hidden="true" />
        <h2 id="cmp-updates-title" className="org-card__title">
          Recent Update
        </h2>
        <Link className="org-card__link" to={organizerPath('reports')}>
          View All <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {items.length === 0 ? (
        <EmptyMessage>No updates yet.</EmptyMessage>
      ) : (
        <ul className="org-list">
          {items.slice(0, 2).map((item) => (
            <li key={item.id} className="org-list__row">
              <CircleCheck className="org-updates__icon" size={26} aria-hidden="true" />
              <span className="org-list__text">
                {item.summary} – {item.subject}
              </span>
              <time className="org-list__meta" dateTime={item.at}>
                {formatAgo(item.at, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface CompetitionsViewProps {
  data: CompetitionsData
  /** Fetches the page data again after a change the server accepted. */
  refresh: () => Promise<CompetitionsData | null>
}

function CompetitionsView({ data, refresh }: CompetitionsViewProps) {
  const { region, setRegion } = useOrganizerShell()
  const [announcement, setAnnouncement] = useState('')
  const [params, setParams] = useSearchParams()
  const now = new Date(data.generatedAt)
  const { competitions } = data

  // What is open lives in the URL: ?event=<id> (details), ?new=competition|event (forms).
  const openId = params.get('event')
  const creating = params.get('new')
  const open = competitions.find((c) => c.id === openId) ?? null
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        next.delete('new')
        if (value) next.set(key, value)
        return next
      },
      { replace: value === null },
    )

  const events = competitions.flatMap((c) => c.events)
  const upcoming = useKnown(events.filter((e) => new Date(e.startsAt) >= now).length)
  const awaiting = useKnown(data.attention.reduce((sum, item) => sum + item.count, 0))

  // Changes go to the server; the page shows what the server then reports.
  async function createCompetition(input: NewCompetition) {
    await organizerApi.createCompetition(input)
    setParam('new', null)
    setAnnouncement(`${input.name} created as a draft.`)
    await refresh()
  }

  async function createEvent(input: NewCompetitionEvent) {
    await organizerApi.createEvent(input)
    setParam('new', null)
    setAnnouncement(`${input.name} added to ${competitions.find((c) => c.id === input.competitionId)?.name ?? 'the competition'}.`)
    await refresh()
  }

  return (
    <div className="org-overview org-cmp" data-testid="competitions-page">
      <HeroBanner eyebrow="Competitions & Events" title="Competitions & Events" subtitle="Manage your competitions and events across regions and sports." art="balls">
        <Link className="org-btn org-btn--primary" to="?new=competition">
          <CirclePlus size={24} strokeWidth={2.2} aria-hidden="true" />
          Create Competition
        </Link>
        <Link className="org-btn org-btn--ghost" to="?new=event">
          <CalendarDays size={22} aria-hidden="true" />
          Create Event
        </Link>
      </HeroBanner>

      <NotConnectedNotice />

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <StatCards
        stats={[
          { key: 'active', value: data.activeCompetitions, label: 'Active Competitions', icon: Trophy, tone: 'violet' },
          { key: 'upcoming', value: upcoming, label: 'Upcoming Events', icon: CalendarCheck, tone: 'blue' },
          { key: 'review', value: awaiting, label: 'Awaiting Review', icon: ClipboardCheck, tone: 'orange' },
        ]}
      />

      <div className="org-cmp__row org-cmp__row--main">
        <CompetitionDirectory competitions={competitions} region={region} onRegionChange={setRegion} onOpen={(c) => setParam('event', c.id)} />
        <NeedsAttention items={data.attention} />
      </div>
      <div className="org-cmp__row org-cmp__row--foot">
        <PlanningSummary events={events} />
        <RecentUpdateCard items={data.updates} now={now} />
      </div>

      <CompetitionDrawer competition={open} onClose={() => setParam('event', null)} now={now} />
      <CreateCompetitionDialog open={creating === 'competition'} onClose={() => setParam('new', null)} onCreate={createCompetition} />
      <CreateEventDialog open={creating === 'event'} competitions={competitions} onClose={() => setParam('new', null)} onCreate={createEvent} />
    </div>
  )
}

function CompetitionsSkeleton() {
  return (
    <div className="org-overview" aria-busy="true">
      <span role="status" className="visually-hidden">
        Loading competitions
      </span>
      <div className="org-skeleton org-skeleton--hero" />
      <div className="org-stats">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--kpi" />
        ))}
      </div>
      <div className="org-cmp__row org-cmp__row--main">
        <div className="org-skeleton org-skeleton--card-lg" />
        <div className="org-skeleton org-skeleton--card-lg" />
      </div>
    </div>
  )
}

/** Competitions & Events — the organizer's competition directory and event planning. */
export function CompetitionsPage() {
  const state = useCompetitions()
  useDocumentTitle('Competitions & Events')

  return (
    <ResourceView resource={state} skeleton={<CompetitionsSkeleton />} errorTitle="We couldn't load your competitions" empty={emptyCompetitions}>
      {(data) => <CompetitionsView data={data} refresh={state.refresh} />}
    </ResourceView>
  )
}
