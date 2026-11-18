/**
 * Response shapes for the Organizer Overview.
 *
 * These are the contract the UI renders. Today they are filled from
 * mockOverview.ts; when the backend endpoint exists, organizerApi.ts returns the
 * same shapes from the API and nothing in the components changes.
 * All instants are ISO-8601 strings in UTC; each event carries its own IANA zone.
 */

export type SportId = 'football' | 'basketball' | 'cricket' | 'tennis' | 'soccer' | 'baseball' | 'ice-hockey'

export type RegionId = 'north-america' | 'south-america' | 'europe' | 'africa' | 'asia' | 'oceania'

export type EventStatus = 'confirmed' | 'scheduled' | 'preparing' | 'ready' | 'in-progress'

export type KpiId = 'active-competitions' | 'total-events' | 'participating-organizations' | 'countries-regions'

export interface Kpi {
  id: KpiId
  label: string
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
  /** The last 12 months, oldest first. */
  months: ActivityPoint[]
  /** Change against the equal period before, by window length in months. */
  changePercent: { 6: number; 12: number }
}

export interface Participation {
  registeredTeams: number
  countries: number
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
  hero: { title: string; subtitle: string }
  kpis: Kpi[]
  upcomingEvents: UpcomingEvent[]
  activity: CompetitionActivity
  participation: Participation
  alerts: OperationalAlert[]
  tasks: { totalPending: number; items: ApprovalTask[] }
  recentUpdates: RecentUpdate[]
  actionCenter: { open: number }
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

export interface ActionCenterData {
  generatedAt: string
  hero: { title: string; subtitle: string }
  /** Totals across everything, not only the rows sent. */
  summary: { actions: number; approvals: number; deadlines: number; alerts: number }
  /** Highest priority first, then soonest due. */
  queue: ActionItem[]
  approvals: ApprovalGroup[]
  alerts: OperationalAlert[]
  deadlines: Deadline[]
}

/* --------------------------------------------------- Competitions & Events */

export type CountryCode = 'US' | 'CA' | 'AR' | 'ES' | 'NG' | 'JP' | 'IN' | 'AU'

/** Competition lifecycle, in order. */
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
  hero: { eyebrow: string; title: string; subtitle: string }
  /** Organization-wide count; the directory lists the competitions you manage. */
  activeCompetitions: number
  competitions: Competition[]
  attention: AttentionItem[]
  updates: RecentUpdate[]
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
}

export interface ScheduleConflict {
  id: string
  fixtureId: string
  kind: 'venue' | 'officials'
  title: string
  detail: string
}

export interface FixturesData {
  generatedAt: string
  hero: { eyebrow: string; title: string; subtitle: string }
  /** Organization-wide totals; the list shows your upcoming fixtures. */
  summary: { total: number; confirmed: number; pendingReview: number; conflicts: number }
  fixtures: Fixture[]
  conflicts: ScheduleConflict[]
  /** Days (YYYY-MM-DD) when a competition event starts, for the calendar. */
  eventDays: string[]
}
