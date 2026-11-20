/**
 * View models for the Organizer workspace: exactly what each screen renders.
 *
 * These describe the UI's needs, not the backend's wire format. When the API
 * contract is agreed, organizerApi.ts maps its responses onto these shapes, so
 * components do not change. All instants are ISO-8601 strings in UTC; anything
 * placed in time carries its own IANA zone.
 *
 * `null` (or an absent key) means "not known", which the UI shows as "—" or an
 * explanatory empty state. It never means zero.
 */

export type SportId = 'football' | 'basketball' | 'cricket' | 'tennis' | 'soccer' | 'baseball' | 'ice-hockey'

export type RegionId = 'north-america' | 'south-america' | 'europe' | 'africa' | 'asia' | 'oceania'

export type EventStatus = 'confirmed' | 'scheduled' | 'preparing' | 'ready' | 'in-progress'

/* ----------------------------------------------------------------- Overview */

/** The four headline figures of the Overview design (labels and icons live in the UI). */
export type KpiId = 'active-competitions' | 'total-events' | 'participating-organizations' | 'countries-regions'

export interface KpiValue {
  value: number
  /** Percentage change against the previous period; omitted when not meaningful. */
  changePercent?: number
}

export interface UpcomingEvent {
  id: string
  name: string
  sport: SportId
  region: RegionId
  city: string
  country: string
  startsAt: string
  endsAt: string
  timeZone: string
  status: EventStatus
}

/** Competitions run per calendar month (oldest first, `month` as YYYY-MM). */
export interface ActivityPoint {
  month: string
  competitions: number
}

export interface CompetitionActivity {
  /** Up to the last 12 months, oldest first. */
  months: ActivityPoint[]
  /** Change against the equal period before, by window length in months. */
  changePercent: Partial<Record<6 | 12, number>>
}

export interface Participation {
  registeredTeams: number | null
  countries: number | null
  /** Regions with active participants, marked on the map. */
  regions: RegionId[]
}

export interface OperationalAlert {
  id: string
  severity: 'critical' | 'warning'
  title: string
  createdAt: string
}

export interface ApprovalTask {
  id: string
  label: string
  pending: number
  /** Organizer module that handles it (route segment). */
  module: string
}

export interface RecentUpdate {
  id: string
  summary: string
  subject: string
  at: string
}

export interface Notification {
  id: string
  title: string
  detail: string
  createdAt: string
  unread: boolean
}

export interface OrganizerOverview {
  generatedAt: string
  kpis: Partial<Record<KpiId, KpiValue>>
  upcomingEvents: UpcomingEvent[]
  activity: CompetitionActivity | null
  participation: Participation | null
  alerts: OperationalAlert[]
  tasks: { totalPending: number | null; items: ApprovalTask[] }
  recentUpdates: RecentUpdate[]
  /** Open items for the sidebar badge; null hides the badge. */
  actionCenter: { open: number | null }
  notifications: Notification[]
}

/* ------------------------------------------------------------ Action Center */

export type ActionPriority = 'high' | 'medium' | 'low'

/** What an action is about; picks its icon. */
export type ActionKind = 'schedule' | 'registration' | 'review' | 'document' | 'venue'

export interface ActionItem {
  id: string
  title: string
  /** Event (and place) it concerns. */
  context: string
  kind: ActionKind
  priority: ActionPriority
  dueAt: string
  /** Organizer module that handles it (route segment). */
  module: string
}

export type ApprovalKind = 'registration' | 'venue' | 'fixture' | 'document' | 'sponsorship' | 'media' | 'officials'

export interface ApprovalGroup {
  id: string
  kind: ApprovalKind
  title: string
  /** "8 organizations", "3 venues"… */
  scope: string
  pending: number
  module: string
}

export interface Deadline {
  id: string
  title: string
  dueAt: string
  module: string
}

/** Totals across everything, not only the rows sent. */
export interface ActionSummary {
  actions: number
  approvals: number
  deadlines: number
  alerts: number
}

export interface ActionCenterData {
  generatedAt: string
  summary: ActionSummary | null
  /** Highest priority first, then soonest due. */
  queue: ActionItem[]
  approvals: ApprovalGroup[]
  alerts: OperationalAlert[]
  deadlines: Deadline[]
}

/* --------------------------------------------------- Competitions & Events */

export type CountryCode = 'US' | 'CA' | 'AR' | 'ES' | 'NG' | 'JP' | 'IN' | 'AU'

/** Competition lifecycle, in order (pending confirmation of the agreed lifecycle). */
export type CompetitionStatus = 'draft' | 'scheduled' | 'preparing' | 'active' | 'completed'

export type CompetitionEventStatus = 'confirmed' | 'planning' | 'draft'

export interface CompetitionEvent {
  id: string
  name: string
  venue: string
  startsAt: string
  status: CompetitionEventStatus
}

export interface HistoryEntry {
  id: string
  at: string
  actor: string
  summary: string
}

export interface Competition {
  id: string
  name: string
  sport: SportId
  country: CountryCode
  region: RegionId
  city: string
  timeZone: string
  startsAt: string
  endsAt: string
  status: CompetitionStatus
  /** Organizations taking part. */
  organizations: number
  events: CompetitionEvent[]
  history: HistoryEntry[]
}

export interface AttentionItem {
  id: string
  kind: 'schedule' | 'venue' | 'participation'
  /** Items waiting in this group. */
  count: number
  title: string
  detail: string
  cta: string
  module: string
}

export interface CompetitionsData {
  generatedAt: string
  /** Organization-wide count; the directory lists the competitions you manage. */
  activeCompetitions: number | null
  competitions: Competition[]
  attention: AttentionItem[]
  updates: RecentUpdate[]
}

/** What the Create Competition form collects. Dates are calendar days as entered (YYYY-MM-DD). */
export interface NewCompetition {
  name: string
  sport: SportId
  country: CountryCode
  startDate: string
  endDate: string
}

/** What the Create Event form collects. */
export interface NewCompetitionEvent {
  competitionId: string
  name: string
  venue: string
  /** Calendar day as entered (YYYY-MM-DD). */
  date: string
  status: CompetitionEventStatus
}

/* ------------------------------------------------------ Fixtures & Schedule */

/** One published version of a fixture's time and place. */
export interface FixtureRevision {
  version: number
  startsAt: string
  venue: string
  reason: string
  author: string
  publishedAt: string
}

/**
 * A proposed change that is not yet published. "proposed" is a draft; once
 * approval is requested it is "awaiting-approval" until published or discarded.
 */
export interface FixtureChange {
  /** The version this change will become. */
  version: number
  /** The published version it was proposed against (publication fails if that moved). */
  baseVersion: number
  startsAt: string
  venue: string
  reason: string
  author: string
  proposedAt: string
  state: 'proposed' | 'awaiting-approval'
}

export interface FixtureRecipient {
  role: 'Home club' | 'Away club' | 'Venue' | 'Officials'
  name: string
}

/**
 * What the signed-in user may do with a fixture right now. Decided by the
 * server from their role and event authority; the UI only shows what is allowed.
 */
export type FixtureAction = 'propose' | 'request-approval' | 'approve' | 'discard'

export interface Fixture {
  id: string
  competitionId: string
  competition: string
  sport: SportId
  home: string
  away: string
  city: string
  country: CountryCode
  region: RegionId
  timeZone: string
  /** Published versions, newest first; empty for a fixture never published. */
  revisions: FixtureRevision[]
  change?: FixtureChange
  /** A scheduling conflict raised against this fixture. */
  conflict?: string
  /** Marked as a key match on the calendar. */
  key?: boolean
  recipients: FixtureRecipient[]
  allowedActions: FixtureAction[]
}

export interface ScheduleConflict {
  id: string
  fixtureId: string
  kind: 'venue' | 'officials'
  title: string
  detail: string
}

export interface FixtureSummary {
  total: number
  confirmed: number
  pendingReview: number
  conflicts: number
}

export interface FixturesData {
  generatedAt: string
  /** Organization-wide totals; the list shows your upcoming fixtures. */
  summary: FixtureSummary | null
  fixtures: Fixture[]
  conflicts: ScheduleConflict[]
  /** Days (YYYY-MM-DD) when a competition event starts, for the calendar. */
  eventDays: string[]
}

/** What the Create Fixture form collects. */
export interface NewFixture {
  competitionId: string
  home: string
  away: string
  /** UTC instant of the local date and time entered, in the competition's zone. */
  startsAt: string
}

/** A proposed new time and/or venue for a published fixture. */
export interface FixtureChangeInput {
  /** The published version the change is proposed against. */
  baseVersion: number
  startsAt: string
  venue: string
  reason: string
}

/** Approval and publication of a change awaiting approval. */
export interface PublishInput {
  /** The published version the approver reviewed; publication must fail if it moved. */
  expectedVersion: number
  reason: string
}
