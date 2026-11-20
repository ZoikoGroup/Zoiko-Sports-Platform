import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Camera,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Handshake,
  List,
  Megaphone,
  SquareCheck,
  TriangleAlert,
  UserCheck,
  UserPlus,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { StadiumIcon } from '../../../components/icons'
import { emptyActionCenter } from '../api/empty'
import type { ActionItem, ActionKind, ActionPriority, ActionSummary, ApprovalGroup, ApprovalKind, Deadline } from '../api/types'
import { useActionCenter } from '../api/useOrganizerOverview'
import { EmptyMessage, Metric, NotConnectedNotice, ResourceView } from '../components/DataState'
import { organizerPath } from '../navigation'
import { HeroBanner } from '../overview/HeroBanner'
import { OperationalAlerts } from '../overview/OperationalAlerts'
import { useDocumentTitle } from '../shellContext'

type Icon = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

const ACTION_ICONS: Record<ActionKind, Icon> = {
  schedule: CalendarDays,
  registration: UsersRound,
  review: ClipboardCheck,
  document: FileText,
  venue: StadiumIcon,
}

const APPROVAL_ICONS: Record<ApprovalKind, Icon> = {
  registration: UserPlus,
  venue: StadiumIcon,
  fixture: CalendarDays,
  document: FileText,
  sponsorship: Handshake,
  media: Camera,
  officials: UserCheck,
}

const PRIORITY_LABELS: Record<ActionPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

const dueFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** Rows shown before "View All" expands a card. */
const PREVIEW_ROWS = 5
const PREVIEW_DEADLINES = 3

/** "View All (12) →" that expands the card's list in place; "Show less" collapses it. */
function ExpandToggle({ total, expanded, onToggle, controls }: { total: number; expanded: boolean; onToggle: () => void; controls: string }) {
  return (
    <button type="button" className="org-card__link org-card__link--button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
      {expanded ? 'Show less' : `View All (${total})`}
      <ArrowRight size={18} aria-hidden="true" className={expanded ? 'is-up' : undefined} />
    </button>
  )
}

function CardHead({ icon: IconComponent, title, id, children }: { icon: Icon; title: string; id: string; children?: ReactNode }) {
  return (
    <header className="org-card__head">
      <IconComponent className="org-card__icon" size={26} strokeWidth={2} />
      <h2 id={id} className="org-card__title">
        {title}
      </h2>
      {children}
    </header>
  )
}

interface SummaryCard {
  key: keyof ActionSummary
  label: string
  icon: Icon
  tone: 'violet' | 'blue' | 'orange' | 'red'
  target: string
}

/** The design's four summary cards, in order; their figures come from the server. */
const SUMMARY_CARDS: SummaryCard[] = [
  { key: 'actions', label: 'Actions Requiring Attention', icon: SquareCheck, tone: 'violet', target: 'ac-queue' },
  { key: 'approvals', label: 'Pending Approvals', icon: CircleCheck, tone: 'blue', target: 'ac-approvals' },
  { key: 'deadlines', label: 'Upcoming Deadlines', icon: CalendarCheck, tone: 'orange', target: 'ac-deadlines' },
  { key: 'alerts', label: 'Operational Alerts', icon: TriangleAlert, tone: 'red', target: 'ac-alerts' },
]

function SummaryCards({ summary }: { summary: ActionSummary | null }) {
  return (
    <section className="org-kpis" aria-label="Action summary">
      {SUMMARY_CARDS.map(({ key, label, icon: IconComponent, tone, target }) => (
        <a key={key} href={`#${target}`} className={`org-kpi org-kpi--${tone} org-kpi--link`} data-testid={`summary-${key}`}>
          <IconComponent className="org-kpi__icon" size={46} strokeWidth={1.7} aria-hidden="true" />
          <span className="org-kpi__body">
            <span className="org-kpi__value">
              <Metric value={summary?.[key]} />
            </span>
            <span className="org-kpi__label">{label}</span>
          </span>
          <ChevronRight className="org-kpi__go" size={24} aria-hidden="true" />
        </a>
      ))}
    </section>
  )
}

function ActionQueue({ items, total }: { items: ActionItem[]; total: number | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? items : items.slice(0, PREVIEW_ROWS)
  return (
    <section id="ac-queue" className="org-card org-ac-card" aria-labelledby="ac-queue-title" tabIndex={-1}>
      <CardHead icon={List} title="Action Queue (Prioritized)" id="ac-queue-title">
        {items.length > PREVIEW_ROWS && (
          <ExpandToggle total={total ?? items.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
        )}
      </CardHead>
      {items.length === 0 && <EmptyMessage>No actions need your attention.</EmptyMessage>}
      <ul id={listId} className="org-ac-list">
        {rows.map((item) => {
          const IconComponent = ACTION_ICONS[item.kind]
          return (
            <li key={item.id}>
              <Link className="org-ac-row" to={`${organizerPath(item.module)}?action=${item.id}`} data-testid="action-item">
                <IconComponent className="org-ac-row__icon" size={30} strokeWidth={1.7} />
                <span className="org-ac-row__text">
                  <strong>{item.title}</strong>
                  <span>{item.context}</span>
                </span>
                <span className={`org-priority org-priority--${item.priority}`}>
                  {PRIORITY_LABELS[item.priority]}
                  <span className="visually-hidden"> priority, due {dueFormat.format(new Date(item.dueAt))}</span>
                </span>
                <ArrowRight className="org-ac-row__go" size={20} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ApprovalRequests({ groups, total }: { groups: ApprovalGroup[]; total: number | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? groups : groups.slice(0, PREVIEW_ROWS)
  return (
    <section id="ac-approvals" className="org-card org-ac-card" aria-labelledby="ac-approvals-title" tabIndex={-1}>
      <CardHead icon={CircleCheck} title="Approval Requests" id="ac-approvals-title">
        {groups.length > PREVIEW_ROWS && (
          <ExpandToggle total={total ?? groups.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
        )}
      </CardHead>
      {groups.length === 0 && <EmptyMessage>No approval requests are waiting.</EmptyMessage>}
      <ul id={listId} className="org-ac-list">
        {rows.map((group) => {
          const IconComponent = APPROVAL_ICONS[group.kind]
          return (
            <li key={group.id}>
              <Link className="org-ac-row" to={`${organizerPath(group.module)}?approvals=${group.kind}`} data-testid="approval-group">
                <IconComponent className="org-ac-row__icon" size={30} strokeWidth={1.7} />
                <span className="org-ac-row__text">
                  <strong>{group.title}</strong>
                  <span>{group.scope}</span>
                </span>
                <span className="org-pill">{group.pending} Pending</span>
                <ArrowRight className="org-ac-row__go" size={20} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function UpcomingDeadlines({ deadlines, total }: { deadlines: Deadline[]; total: number | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? deadlines : deadlines.slice(0, PREVIEW_DEADLINES)
  return (
    <section id="ac-deadlines" className="org-card org-ac-card" aria-labelledby="ac-deadlines-title" tabIndex={-1}>
      <CardHead icon={CalendarClock} title="Upcoming Deadlines" id="ac-deadlines-title">
        {deadlines.length > PREVIEW_DEADLINES && (
          <ExpandToggle total={total ?? deadlines.length} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
        )}
      </CardHead>
      {deadlines.length === 0 && <EmptyMessage>No upcoming deadlines.</EmptyMessage>}
      <ul id={listId} className="org-list org-deadlines">
        {rows.map((deadline) => (
          <li key={deadline.id}>
            <Link className="org-list__row org-deadlines__row" to={organizerPath(deadline.module)} data-testid="deadline">
              <time className="org-deadlines__date" dateTime={deadline.dueAt}>
                {dayFormat.format(new Date(deadline.dueAt))}
              </time>
              <span className="org-list__text">{deadline.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const QUICK_ACTIONS: { label: string; to: string; icon: Icon }[] = [
  { label: 'Create Event', to: `${organizerPath('competitions')}?new=event`, icon: CalendarPlus },
  { label: 'Add Organization', to: `${organizerPath('participants')}?new=organization`, icon: UserPlus },
  { label: 'Manage Venues', to: organizerPath('venues'), icon: StadiumIcon },
  { label: 'Update Schedule', to: organizerPath('fixtures'), icon: CalendarDays },
  { label: 'Upload Documents', to: `${organizerPath('content')}?upload=document`, icon: FileText },
  { label: 'Send Communication', to: `${organizerPath('communications')}?new=notice`, icon: Megaphone },
]

function QuickActionsBar() {
  return (
    <section className="org-card org-quickbar" aria-labelledby="ac-quick-title">
      <h2 id="ac-quick-title" className="org-quickbar__title">
        <Zap size={30} aria-hidden="true" />
        Quick Actions
      </h2>
      <ul className="org-quickbar__list">
        {QUICK_ACTIONS.map(({ label, to, icon: IconComponent }) => (
          <li key={label}>
            <Link className="org-quickbar__action" to={to}>
              <IconComponent size={38} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActionCenterSkeleton() {
  return (
    <div className="org-overview" aria-busy="true">
      <span role="status" className="visually-hidden">
        Loading the Action Center
      </span>
      <div className="org-skeleton org-skeleton--hero" />
      <div className="org-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--kpi" />
        ))}
      </div>
      <div className="org-ac-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org-skeleton org-skeleton--card-lg" />
        ))}
      </div>
    </div>
  )
}

/** Action Center — tasks, approvals, alerts and deadlines that need the organizer. */
export function ActionCenterPage() {
  const state = useActionCenter()
  useDocumentTitle('Action Center')

  return (
    <ResourceView resource={state} skeleton={<ActionCenterSkeleton />} errorTitle="We couldn't load the Action Center" empty={emptyActionCenter}>
      {(data) => {
        const { summary } = data
        return (
          <div className="org-overview org-ac" data-testid="action-center">
            <HeroBanner title="Action Center" subtitle="Your operational hub for tasks, approvals and time-critical actions." />
            <NotConnectedNotice />
            <SummaryCards summary={summary} />
            <div className="org-ac-grid">
              <ActionQueue items={data.queue} total={summary?.actions} />
              <ApprovalRequests groups={data.approvals} total={summary?.approvals} />
              <div className="org-ac-side">
                <div id="ac-alerts" tabIndex={-1} className="org-ac-anchor">
                  <OperationalAlerts
                    alerts={data.alerts}
                    now={new Date(data.generatedAt)}
                    viewAll={{ to: organizerPath('event-day'), count: summary?.alerts }}
                    icon={Bell}
                  />
                </div>
                <UpcomingDeadlines deadlines={data.deadlines} total={summary?.deadlines} />
              </div>
            </div>
            <QuickActionsBar />
          </div>
        )
      }}
    </ResourceView>
  )
}
