/**
 * "No data" view models: what each screen renders while its data is not
 * connected. Lists are empty and figures are unknown (null), so screens keep
 * their layout and show "—" or an explanatory empty state. Nothing here is
 * sample content.
 */
import type { ActionCenterData, CompetitionsData, FixturesData, OrganizerOverview } from './types'

const now = () => new Date().toISOString()

export const emptyOverview = (): OrganizerOverview => ({
  generatedAt: now(),
  kpis: {},
  upcomingEvents: [],
  activity: null,
  participation: null,
  alerts: [],
  tasks: { totalPending: null, items: [] },
  recentUpdates: [],
  actionCenter: { open: null },
  notifications: [],
})

export const emptyActionCenter = (): ActionCenterData => ({
  generatedAt: now(),
  summary: null,
  queue: [],
  approvals: [],
  alerts: [],
  deadlines: [],
})

export const emptyCompetitions = (): CompetitionsData => ({
  generatedAt: now(),
  activeCompetitions: null,
  competitions: [],
  attention: [],
  updates: [],
})

export const emptyFixtures = (): FixturesData => ({
  generatedAt: now(),
  summary: null,
  fixtures: [],
  conflicts: [],
  eventDays: [],
})
