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
