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

export type EventStatus = 'ready' | 'in-progress' | 'preparing' | 'scheduled'

export type KpiId = 'active-competitions' | 'live-events' | 'participating-organizations' | 'countries-regions'

export interface Kpi {
  id: KpiId
  label: string
  value: number
  /** Percentage change against the comparison window; omitted when not meaningful. */
  change?: { percent: number; comparedTo: string }
}

export interface UpcomingEvent {
  id: string
  name: string
  sport: SportId
  region: RegionId
  city: string
  country: string
  startsAt: string
  timeZone: string
  status: EventStatus
}

export interface RegionShare {
  region: RegionId
  /** Share of participating organizations, 0–100. */
  percent: number
}

export interface DecisionUpdate {
  id: string
  summary: string
  subject: string
  decidedAt: string
}

export interface ActionCenterSummary {
  open: number
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
  participation: RegionShare[]
  recentDecisions: DecisionUpdate[]
  actionCenter: ActionCenterSummary
  notifications: Notification[]
}
