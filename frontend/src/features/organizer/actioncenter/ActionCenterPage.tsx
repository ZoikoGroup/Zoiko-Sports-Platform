import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Camera,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Handshake,
  List,
  Megaphone,
  RefreshCw,
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
import type { ActionItem, ActionKind, ActionPriority, ApprovalGroup, ApprovalKind, Deadline } from '../api/types'
import { useActionCenter } from '../api/useOrganizerOverview'
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
  key: string
  label: string
  value: number
  icon: Icon
  tone: 'violet' | 'blue' | 'orange' | 'red'
  target: string
}

function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <section className="org-kpis" aria-label="Action summary">
      {cards.map(({ key, label, value, icon: IconComponent, tone, target }) => (
        <a key={key} href={`#${target}`} className={`org-kpi org-kpi--${tone} org-kpi--link`} data-testid={`summary-${key}`}>
          <IconComponent className="org-kpi__icon" size={46} strokeWidth={1.7} aria-hidden="true" />
          <span className="org-kpi__body">
            <span className="org-kpi__value">{value}</span>
            <span className="org-kpi__label">{label}</span>
          </span>
          <ChevronRight className="org-kpi__go" size={24} aria-hidden="true" />
        </a>
      ))}
    </section>
  )
}

function ActionQueue({ items, total }: { items: ActionItem[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? items : items.slice(0, PREVIEW_ROWS)
  return (
    <section id="ac-queue" className="org-card org-ac-card" aria-labelledby="ac-queue-title" tabIndex={-1}>
      <CardHead icon={List} title="Action Queue (Prioritized)" id="ac-queue-title">
        <ExpandToggle total={total} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
      </CardHead>
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

function ApprovalRequests({ groups, total }: { groups: ApprovalGroup[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? groups : groups.slice(0, PREVIEW_ROWS)
  return (
    <section id="ac-approvals" className="org-card org-ac-card" aria-labelledby="ac-approvals-title" tabIndex={-1}>
      <CardHead icon={CircleCheck} title="Approval Requests" id="ac-approvals-title">
        <ExpandToggle total={total} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
      </CardHead>
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

function UpcomingDeadlines({ deadlines, total }: { deadlines: Deadline[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const rows = expanded ? deadlines : deadlines.slice(0, PREVIEW_DEADLINES)
  return (
    <section id="ac-deadlines" className="org-card org-ac-card" aria-labelledby="ac-deadlines-title" tabIndex={-1}>
      <CardHead icon={CalendarClock} title="Upcoming Deadlines" id="ac-deadlines-title">
        <ExpandToggle total={total} expanded={expanded} onToggle={() => setExpanded((v) => !v)} controls={listId} />
      </CardHead>
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

  if (state.status === 'loading') return <ActionCenterSkeleton />
  if (state.status === 'error') {
    return (
      <div className="org-overview">
        <div className="org-card org-error" role="alert">
          <CircleAlert size={28} aria-hidden="true" />
          <div>
            <h1 className="org-card__title">We couldn't load the Action Center</h1>
            <p>{state.error}</p>
          </div>
          <button type="button" className="org-btn org-btn--secondary" onClick={state.reload}>
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }

  const data = state.data
  const { summary } = data
  return (
    <div className="org-overview org-ac" data-testid="action-center">
      <HeroBanner title={data.hero.title} subtitle={data.hero.subtitle} />
      <SummaryCards
        cards={[
          { key: 'actions', label: 'Actions Requiring Attention', value: summary.actions, icon: SquareCheck, tone: 'violet', target: 'ac-queue' },
          { key: 'approvals', label: 'Pending Approvals', value: summary.approvals, icon: CircleCheck, tone: 'blue', target: 'ac-approvals' },
          { key: 'deadlines', label: 'Upcoming Deadlines', value: summary.deadlines, icon: CalendarCheck, tone: 'orange', target: 'ac-deadlines' },
          { key: 'alerts', label: 'Operational Alerts', value: summary.alerts, icon: TriangleAlert, tone: 'red', target: 'ac-alerts' },
        ]}
      />
      <div className="org-ac-grid">
        <ActionQueue items={data.queue} total={summary.actions} />
        <ApprovalRequests groups={data.approvals} total={summary.approvals} />
        <div className="org-ac-side">
          <div id="ac-alerts" tabIndex={-1} className="org-ac-anchor">
            <OperationalAlerts
              alerts={data.alerts}
              now={new Date(data.generatedAt)}
              viewAll={{ to: organizerPath('event-day'), count: summary.alerts }}
              icon={Bell}
            />
          </div>
          <UpcomingDeadlines deadlines={data.deadlines} total={summary.deadlines} />
        </div>
      </div>
      <QuickActionsBar />
    </div>
  )
}
