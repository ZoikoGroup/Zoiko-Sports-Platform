import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Ellipsis,
  FileSearch,
  FileText,
  Globe,
  Layers,
  MapPin,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef, useState, type ComponentType, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { hasPermission } from '../../../auth/roles'
import { StadiumIcon } from '../../../components/icons'
import { emptyVenues } from '../api/empty'
import { organizerApi } from '../api/organizerApi'
import type { ReadinessStatus, RegionalReadiness, RegionId, VenueActivityItem, VenueAttentionItem, VenueReadiness, VenueSummary, VenuesData } from '../api/types'
import { useVenues } from '../api/useOrganizerOverview'
import { useAvailability } from '../components/availability'
import { EmptyMessage, Metric, NotConnectedNotice, ResourceView } from '../components/DataState'
import { FieldSelect } from '../components/FieldSelect'
import { Menu } from '../components/Menu'
import { formatCount, formatLocalDateTime, REGION_LABELS, zoneAbbreviation } from '../format'
import { organizerPath } from '../navigation'
import { HeroBanner } from '../overview/HeroBanner'
import { useDocumentTitle, useOrganizerShell } from '../shellContext'
import { FRAMEWORK_STAGES, isReadinessStatus, percent, placeLabel, READINESS_LABELS, READINESS_STATUSES } from './readiness'
import { VenueDrawer } from './VenueDrawer'

type Icon = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

const PREVIEW_ROWS = 5
const ATTENTION_PREVIEW = 3

/** The design's four summary figures, in order; the values are organization totals from the server. */
const SUMMARY_CARDS: { key: keyof VenueSummary; label: string; icon: Icon; tone: string; testId: string }[] = [
  { key: 'totalVenues', label: 'Total Venues', icon: StadiumIcon, tone: 'blue', testId: 'total' },
  { key: 'ready', label: 'Ready', icon: CircleCheck, tone: 'green', testId: 'ready' },
  { key: 'pendingReview', label: 'Pending Review', icon: Clock, tone: 'orange', testId: 'pending' },
  { key: 'needsAttention', label: 'Needs Attention', icon: TriangleAlert, tone: 'red', testId: 'attention' },
]

/** Tab and status-filter counts come from the summary, so they match the cards above. */
const STATUS_COUNT: Record<ReadinessStatus, keyof VenueSummary> = {
  ready: 'ready',
  'pending-review': 'pendingReview',
  'needs-attention': 'needsAttention',
}

const STATUS_ICONS: Record<ReadinessStatus, LucideIcon> = {
  ready: CircleCheck,
  'pending-review': Clock,
  'needs-attention': TriangleAlert,
}

const ACTIVITY_ICONS: Record<VenueActivityItem['kind'], LucideIcon> = {
  completed: CircleCheck,
  'in-progress': Clock,
  scheduled: CalendarDays,
}

const FRAMEWORK_ICONS: Record<(typeof FRAMEWORK_STAGES)[number]['key'], LucideIcon> = {
  planning: CalendarDays,
  evidence: FileText,
  review: FileSearch,
  ready: CircleCheck,
}

/** "Wed, Nov 18" and "2:00 PM EST": a start time as the venue sees it. */
function localWhen(iso: string, timeZone: string) {
  const instant = new Date(iso)
  const date = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(instant)
  return { date, time: formatLocalDateTime(iso, timeZone).time }
}

const itemsLabel = (n: number) => (n === 1 ? '1 item' : `${formatCount(n)} items`)

function SummaryCards({ summary }: { summary: VenueSummary | null }) {
  return (
    <section className="org-stats org-stats--four" aria-label="Venue readiness summary">
      {SUMMARY_CARDS.map(({ key, label, icon: IconComponent, tone, testId }) => (
        <article key={key} className={`org-stat org-stat--${tone} org-vr-stat`} data-testid={`vr-stat-${testId}`}>
          <span className="org-vr-stat__icon" aria-hidden="true">
            <IconComponent size={30} strokeWidth={1.9} />
          </span>
          <p className="org-stat__body">
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

interface QueueProps {
  venues: VenueReadiness[]
  summary: VenueSummary | null
  status: ReadinessStatus | null
  competition: string | null
  region: RegionId | 'all'
  onStatus: (status: ReadinessStatus | null) => void
  onCompetition: (competitionId: string | null) => void
  onRegion: (region: RegionId | 'all') => void
  /** Opens a venue's details; `request` focuses the request-an-update form. */
  onOpen: (venue: VenueReadiness, request?: boolean) => void
  /** The active role may ask venues for an update (session permissions, D-045). */
  canRequest: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}

function ReadinessQueue({ venues, summary, status, competition, region, onStatus, onCompetition, onRegion, onOpen, canRequest, headingRef }: QueueProps) {
  const [expanded, setExpanded] = useState(false)
  const live = useAvailability() === 'live'

  const competitions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const v of venues) byId.set(v.competitionId, v.competition)
    if (competition && !byId.has(competition)) byId.set(competition, 'Selected competition')
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [venues, competition])

  const rows = useMemo(
    () =>
      venues
        .filter((v) => !status || v.status === status)
        .filter((v) => !competition || v.competitionId === competition)
        .filter((v) => region === 'all' || v.region === region)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [venues, status, competition, region],
  )
  const visible = expanded ? rows : rows.slice(0, PREVIEW_ROWS)
  const count = (key: keyof VenueSummary) => (live && summary ? summary[key] : null)

  const tabs: { value: ReadinessStatus | null; label: string; total: number | null }[] = [
    { value: null, label: 'All Venues', total: count('totalVenues') },
    ...READINESS_STATUSES.map((s) => ({ value: s, label: READINESS_LABELS[s], total: count(STATUS_COUNT[s]) })),
  ]

  return (
    <section className="org-card org-vr-queue" aria-labelledby="vr-queue-title" id="vr-queue">
      <header className="org-card__head">
        <StadiumIcon className="org-card__icon" size={28} />
        <h2 id="vr-queue-title" className="org-card__title" ref={headingRef} tabIndex={-1}>
          Venue Readiness Queue
        </h2>
        {rows.length > PREVIEW_ROWS && (
          <button type="button" className="org-card__link org-card__link--button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show fewer' : 'View all venues'} <ArrowRight size={18} aria-hidden="true" className={expanded ? 'is-up' : undefined} />
          </button>
        )}
      </header>

      <div className="org-vr-tabs" role="group" aria-label="Readiness status">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className="org-vr-tab"
            aria-pressed={status === tab.value}
            onClick={() => onStatus(tab.value)}
            data-testid={`vr-tab-${tab.value ?? 'all'}`}
          >
            {tab.label}
            {tab.total !== null && <span className="org-vr-tab__count"> ({formatCount(tab.total)})</span>}
          </button>
        ))}
      </div>

      <div className="org-vr-filters" role="group" aria-label="Filter venues">
        <FieldSelect
          label="Competition"
          value={competition ?? 'all'}
          options={[{ value: 'all', label: 'All Competitions' }, ...competitions]}
          onChange={(v) => onCompetition(v === 'all' ? null : v)}
        />
        <FieldSelect
          label="Region"
          value={region}
          options={[{ value: 'all', label: 'All Regions' }, ...(Object.keys(REGION_LABELS) as RegionId[]).map((r) => ({ value: r, label: REGION_LABELS[r] }))]}
          onChange={(v) => onRegion(v as RegionId | 'all')}
        />
        <FieldSelect
          label="Status"
          value={status ?? 'all'}
          options={[{ value: 'all', label: 'All Statuses' }, ...READINESS_STATUSES.map((s) => ({ value: s, label: READINESS_LABELS[s] }))]}
          onChange={(v) => onStatus(isReadinessStatus(v) ? v : null)}
        />
      </div>

      {venues.length === 0 ? (
        <EmptyMessage>No venues share readiness with your events yet.</EmptyMessage>
      ) : visible.length === 0 ? (
        <div className="org-empty">
          <p>No venues match these filters.</p>
        </div>
      ) : (
        <div className="org-vr-queue__scroll">
          <table className="org-table org-vr-table">
            <caption className="visually-hidden">Venue readiness by event</caption>
            <thead>
              <tr>
                <th scope="col">Venue</th>
                <th scope="col">Event / Competition</th>
                <th scope="col">Location</th>
                <th scope="col">Local Time</th>
                <th scope="col">Readiness Status</th>
                <th scope="col">Evidence</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((v) => {
                const { date, time } = localWhen(v.startsAt, v.timeZone)
                const StatusIcon = STATUS_ICONS[v.status]
                return (
                  <tr key={v.id} data-testid="venue-row">
                    <th scope="row">
                      <span className="org-vr-venue">
                        <span className={`org-vr-tile org-vr-tile--${v.status}`} aria-hidden="true">
                          <StadiumIcon size={20} />
                        </span>
                        <button type="button" className="org-table__link" onClick={() => onOpen(v)}>
                          {v.venue}
                        </button>
                      </span>
                    </th>
                    <td className="org-vr-event">
                      <strong>{v.event}</strong>
                      <span>{v.competition}</span>
                    </td>
                    <td>
                      <span className="org-table__country">
                        <MapPin size={17} aria-hidden="true" />
                        {placeLabel(v)}
                      </span>
                    </td>
                    <td className="org-vr-when">
                      <span>{date}</span>
                      <span>{time}</span>
                    </td>
                    <td>
                      <span className={`org-status org-status--vr-${v.status}`}>
                        <StatusIcon size={16} aria-hidden="true" />
                        {READINESS_LABELS[v.status]}
                      </span>
                    </td>
                    <td>
                      <span className="org-vr-evidence">
                        <FileText size={17} aria-hidden="true" />
                        {itemsLabel(v.evidenceItems)}
                      </span>
                    </td>
                    <td className="org-table__go">
                      <Menu
                        label={`Actions for ${v.venue}`}
                        trigger={<Ellipsis size={20} aria-hidden="true" />}
                        triggerClassName="org-card__tool"
                        align="end"
                      >
                        {(close) => (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              className="org-menu__item"
                              onClick={() => {
                                close()
                                onOpen(v)
                              }}
                            >
                              View readiness
                            </button>
                            {canRequest && (
                              <button
                                type="button"
                                role="menuitem"
                                className="org-menu__item"
                                onClick={() => {
                                  close()
                                  onOpen(v, true)
                                }}
                              >
                                Request an update
                              </button>
                            )}
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AttentionCard({ items, total, onOpen, onViewAll }: { items: VenueAttentionItem[]; total: number | null; onOpen: (readinessId: string) => void; onViewAll: () => void }) {
  return (
    <section className="org-card org-vr-attention" aria-labelledby="vr-attention-title">
      <header className="org-card__head">
        <TriangleAlert className="org-card__icon" size={28} aria-hidden="true" />
        <h2 id="vr-attention-title" className="org-card__title">
          Needs Attention
        </h2>
        {items.length > 0 && (
          <button type="button" className="org-card__link org-card__link--button" onClick={onViewAll}>
            View all{total !== null && ` ${formatCount(total)}`} <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <EmptyMessage>No venue needs your attention.</EmptyMessage>
      ) : (
        <ul className="org-vr-attention__list">
          {items.slice(0, ATTENTION_PREVIEW).map((item) => {
            const IconComponent = item.severity === 'high' ? ShieldAlert : TriangleAlert
            const body = (
              <>
                <span className={`org-vr-attention__icon org-vr-attention__icon--${item.severity}`} aria-hidden="true">
                  <IconComponent size={22} />
                </span>
                <span className="org-vr-attention__text">
                  <strong>{item.venue}</strong>
                  <span>{item.detail}</span>
                </span>
                <span className={`org-priority org-priority--${item.severity}`}>{item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}</span>
              </>
            )
            return (
              <li key={item.id}>
                {item.readinessId ? (
                  <button type="button" className="org-vr-attention__row" onClick={() => onOpen(item.readinessId as string)} aria-label={`Open ${item.venue}: ${item.detail}`}>
                    {body}
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="org-vr-attention__row">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ActivityCard({ items, onOpen }: { items: VenueActivityItem[]; onOpen: (readinessId: string) => void }) {
  return (
    <section className="org-card org-vr-activity" aria-labelledby="vr-activity-title">
      <header className="org-card__head">
        <CalendarDays className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="vr-activity-title" className="org-card__title">
          Today&apos;s Venue Activity
        </h2>
        <Link className="org-card__link" to={organizerPath('fixtures')}>
          View calendar <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {items.length === 0 ? (
        <EmptyMessage>No venue activity today.</EmptyMessage>
      ) : (
        <ul className="org-list org-vr-activity__list">
          {items.map((item) => {
            const IconComponent = ACTIVITY_ICONS[item.kind]
            const time = new Intl.DateTimeFormat('en-US', { timeZone: item.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(item.at))
            const text = (
              <>
                <strong>{item.venue}</strong> — {item.summary}
              </>
            )
            return (
              <li key={item.id} className="org-list__row">
                <IconComponent className={`org-vr-activity__icon org-vr-activity__icon--${item.kind}`} size={22} aria-hidden="true" />
                <span className="org-list__text">
                  {item.readinessId ? (
                    <button type="button" className="org-vr-activity__open" onClick={() => onOpen(item.readinessId as string)}>
                      {text}
                    </button>
                  ) : (
                    text
                  )}
                </span>
                <time className="org-list__meta" dateTime={item.at}>
                  {time} {zoneAbbreviation(new Date(item.at), item.timeZone)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RegionalSnapshot({ regions, onRegion }: { regions: RegionalReadiness[]; onRegion: (region: RegionId) => void }) {
  return (
    <section className="org-card org-vr-regions" aria-labelledby="vr-regions-title">
      <header className="org-card__head">
        <Globe className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="vr-regions-title" className="org-card__title">
          Regional Readiness Snapshot
        </h2>
        <Link className="org-card__link" to={organizerPath('reports')}>
          View by region <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </header>
      {regions.length === 0 ? (
        <EmptyMessage>No regional readiness to show yet.</EmptyMessage>
      ) : (
        <ul className="org-vr-regions__list">
          {regions.map((r) => {
            const share = percent(r.ready, r.total)
            return (
              <li key={r.region}>
                <button type="button" className="org-vr-region" onClick={() => onRegion(r.region)} aria-label={`Show ${REGION_LABELS[r.region]} venues: ${r.ready} of ${r.total} ready`}>
                  <strong>{REGION_LABELS[r.region]}</strong>
                  <span>
                    {formatCount(r.ready)} / {formatCount(r.total)} Ready
                  </span>
                  <span className="org-vr-region__bar">
                    <span className="org-progress" aria-hidden="true">
                      <span className="org-progress__fill" style={{ width: `${share ?? 0}%` }} />
                    </span>
                    <span className="org-vr-region__pct">{share === null ? '—' : `${share}%`}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ReadinessFramework() {
  return (
    <section className="org-card org-vr-framework" aria-labelledby="vr-framework-title">
      <header className="org-card__head">
        <Layers className="org-card__icon" size={26} aria-hidden="true" />
        <h2 id="vr-framework-title" className="org-card__title">
          Readiness Framework
        </h2>
      </header>
      <p className="org-vr-framework__intro">Core stages to ensure each venue is event-ready.</p>
      <ol className="org-vr-framework__stages">
        {FRAMEWORK_STAGES.map((stage) => {
          const IconComponent = FRAMEWORK_ICONS[stage.key]
          return (
            <li key={stage.key} className={`org-vr-stage org-vr-stage--${stage.tone}`}>
              <IconComponent size={24} aria-hidden="true" />
              <span>{stage.label}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

interface VenuesViewProps {
  data: VenuesData
  /** Fetches the page data again after a change the server accepted. */
  refresh: () => Promise<VenuesData | null>
}

function VenuesView({ data, refresh }: VenuesViewProps) {
  const { region, setRegion } = useOrganizerShell()
  const [params, setParams] = useSearchParams()
  const [announcement, setAnnouncement] = useState('')
  const queueHeading = useRef<HTMLHeadingElement>(null)
  const live = useAvailability() === 'live'
  const { session } = useAuth()
  const canRequest = hasPermission(session, 'readiness.request_update')

  // What is shown lives in the URL: ?status=…, ?competition=… (filters) and ?venue=… (details).
  const statusParam = params.get('status')
  const status = isReadinessStatus(statusParam) ? statusParam : null
  const competition = params.get('competition')
  const open = data.venues.find((v) => v.id === params.get('venue')) ?? null

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

  const showQueue = (changes: Record<string, string | null>) => {
    update(changes)
    document.getElementById('vr-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    queueHeading.current?.focus({ preventScroll: true })
  }

  return (
    <div className="org-overview org-vr" data-testid="venues-page">
      <HeroBanner
        eyebrow="Global Competition Operations / Dashboard 05"
        title="Venues & Readiness"
        subtitle="Coordinate venue readiness, evidence, and operational checks across events and regions."
        art="stadium"
      >
        <button type="button" className="org-btn org-btn--primary" onClick={() => showQueue({ status: 'pending-review' })}>
          <ClipboardCheck size={22} aria-hidden="true" />
          Review Readiness
        </button>
        <Link className="org-btn org-btn--ghost" to={organizerPath('fixtures')}>
          <CalendarDays size={22} aria-hidden="true" />
          Venue Calendar
        </Link>
      </HeroBanner>

      <NotConnectedNotice />

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <SummaryCards summary={data.summary} />

      <div className="org-vr__layout">
        <div className="org-vr__main">
          <ReadinessQueue
            venues={data.venues}
            summary={data.summary}
            status={status}
            competition={competition}
            region={region}
            onStatus={(s) => update({ status: s })}
            onCompetition={(c) => update({ competition: c })}
            onRegion={setRegion}
            onOpen={(v, request) => update({ venue: v.id, request: request ? '1' : null }, true)}
            canRequest={canRequest}
            headingRef={queueHeading}
          />
          <RegionalSnapshot
            regions={data.regions}
            onRegion={(r) => {
              setRegion(r)
              showQueue({})
            }}
          />
        </div>
        <aside className="org-vr__side" aria-label="Attention, activity and framework">
          <AttentionCard
            items={data.attention}
            total={live ? data.attention.length : null}
            onOpen={(id) => update({ venue: id }, true)}
            onViewAll={() => showQueue({ status: 'needs-attention' })}
          />
          <ActivityCard items={data.activity} onOpen={(id) => update({ venue: id }, true)} />
          <ReadinessFramework />
        </aside>
      </div>

      <VenueDrawer
        venue={open}
        focusRequest={params.get('request') === '1'}
        canRequest={canRequest}
        onClose={() => update({ venue: null, request: null })}
        onRequestUpdate={async (v, message) => {
          await organizerApi.requestReadinessUpdate(v.id, message)
          setAnnouncement(`Update requested from ${v.venue}.`)
          await refresh()
        }}
      />
    </div>
  )
}

function VenuesSkeleton() {
  return (
    <div className="org-overview" aria-busy="true">
      <span role="status" className="visually-hidden">
        Loading venue readiness
      </span>
      <div className="org-skeleton org-skeleton--hero" />
      <div className="org-stats org-stats--four">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--kpi" />
        ))}
      </div>
      <div className="org-vr__layout">
        <div className="org-skeleton org-skeleton--card-lg" />
        <div className="org-skeleton org-skeleton--card-lg" />
      </div>
    </div>
  )
}

/** Venues & Readiness — each venue's readiness, evidence and checks across events and regions. */
export function VenuesPage() {
  const state = useVenues()
  useDocumentTitle('Venues & Readiness')

  return (
    <ResourceView resource={state} skeleton={<VenuesSkeleton />} errorTitle="We couldn't load venue readiness" empty={emptyVenues}>
      {(data) => <VenuesView data={data} refresh={state.refresh} />}
    </ResourceView>
  )
}
