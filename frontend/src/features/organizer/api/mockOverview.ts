/**
 * Static demo data for the Organizer Overview, in the exact shape the API will
 * return (types.ts). Dates are placed relative to "now" so the dashboard always
 * looks current: upcoming events stay upcoming and "10 min ago" stays recent.
 * Every name here is fictional.
 */
import { at, minutesAgo } from './mockTime'
import type { ActivityPoint, OrganizerOverview, UpcomingEvent } from './types'


/** A multi-day event: starts `from` days ahead at `hour`, ends `days` later in the evening. */
function event(
  now: Date,
  base: Omit<UpcomingEvent, 'startsAt' | 'endsAt'>,
  from: number,
  days: number,
  hour: number,
): UpcomingEvent {
  return {
    ...base,
    startsAt: at(now, from, hour, 0, base.timeZone),
    endsAt: at(now, from + days, 21, 0, base.timeZone),
  }
}

/** Twelve monthly totals ending with the current month. */
function activityMonths(now: Date): ActivityPoint[] {
  const values = [61, 70, 66, 78, 84, 80, 52, 94, 97, 126, 128, 138]
  return values.map((competitions, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (values.length - 1 - i), 1)
    return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, competitions }
  })
}

export function buildMockOverview(now = new Date()): OrganizerOverview {
  const upcomingEvents: UpcomingEvent[] = [
    event(now, { id: 'evt-nafs', name: 'North America Pro Football Showcase', sport: 'football', region: 'north-america', city: 'Los Angeles', country: 'United States', timeZone: 'America/Los_Angeles', status: 'confirmed' }, 4, 2, 18),
    event(now, { id: 'evt-gbs', name: 'Global Basketball Series', sport: 'basketball', region: 'asia', city: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo', status: 'scheduled' }, 9, 3, 15),
    event(now, { id: 'evt-wcq', name: 'World Cricket Qualifier', sport: 'cricket', region: 'asia', city: 'Mumbai', country: 'India', timeZone: 'Asia/Kolkata', status: 'preparing' }, 18, 7, 10),
    event(now, { id: 'evt-apto', name: 'Asia-Pacific Tennis Open', sport: 'tennis', region: 'oceania', city: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney', status: 'ready' }, 26, 5, 11),
    event(now, { id: 'evt-ecsc', name: 'European Club Soccer Cup', sport: 'soccer', region: 'europe', city: 'Madrid', country: 'Spain', timeZone: 'Europe/Madrid', status: 'scheduled' }, 34, 4, 18),
    event(now, { id: 'evt-ccbc', name: 'Continental Basketball Cup', sport: 'basketball', region: 'africa', city: 'Lagos', country: 'Nigeria', timeZone: 'Africa/Lagos', status: 'preparing' }, 41, 3, 16),
    event(now, { id: 'evt-casi', name: 'Copa Andina Soccer Invitational', sport: 'soccer', region: 'south-america', city: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', status: 'scheduled' }, 52, 6, 17),
    event(now, { id: 'evt-nihc', name: 'Northern Ice Hockey Cup', sport: 'ice-hockey', region: 'north-america', city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto', status: 'scheduled' }, 63, 4, 19),
  ]

  return {
    generatedAt: now.toISOString(),
    hero: {
      title: 'Global Competition Operations',
      subtitle: 'Plan, manage and deliver world-class sporting events across markets.',
    },
    kpis: [
      { id: 'active-competitions', label: 'Active Competitions', value: 142, changePercent: 8 },
      { id: 'total-events', label: 'Total Events', value: 1248, changePercent: 12 },
      { id: 'participating-organizations', label: 'Participating Organizations', value: 2847, changePercent: 6 },
      { id: 'countries-regions', label: 'Countries / Regions', value: 196 },
    ],
    upcomingEvents,
    activity: { months: activityMonths(now), changePercent: { 6: 24, 12: 31 } },
    participation: {
      registeredTeams: 18420,
      countries: 196,
      regions: ['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania'],
    },
    alerts: [
      { id: 'al-1', severity: 'critical', title: 'Venue readiness pending – 3 events', createdAt: minutesAgo(now, 0) },
      { id: 'al-2', severity: 'warning', title: 'Registration approvals – 12 organizations', createdAt: minutesAgo(now, 120) },
      { id: 'al-3', severity: 'warning', title: 'Schedule conflict – Event #64582', createdAt: minutesAgo(now, 240) },
    ],
    tasks: {
      totalPending: 12,
      items: [
        { id: 'tk-1', label: 'Approve team registrations', pending: 5, module: 'participants' },
        { id: 'tk-2', label: 'Review venue readiness', pending: 3, module: 'venues' },
        { id: 'tk-3', label: 'Confirm event schedules', pending: 2, module: 'fixtures' },
      ],
    },
    recentUpdates: [
      { id: 'up-1', summary: 'New organization onboarded', subject: 'Pacific Athletics Association', at: minutesAgo(now, 10) },
      { id: 'up-2', summary: 'Event registration updated', subject: 'Global Basketball Series', at: minutesAgo(now, 32) },
      { id: 'up-3', summary: 'Officials assigned', subject: 'North America Pro Football Showcase', at: minutesAgo(now, 95) },
    ],
    actionCenter: { open: 8 },
    notifications: [
      { id: 'n-1', title: 'Fixture change needs approval', detail: 'European Club Soccer Cup · kick-off moved to 20:00', createdAt: minutesAgo(now, 12), unread: true },
      { id: 'n-2', title: 'Venue checklist completed', detail: 'Asia-Pacific Tennis Open · all checks done', createdAt: minutesAgo(now, 47), unread: false },
      { id: 'n-3', title: 'New registration request', detail: 'Copa Andina Soccer Invitational · 3 clubs', createdAt: minutesAgo(now, 140), unread: false },
      { id: 'n-4', title: 'Schedule published', detail: 'Global Basketball Series · version 2', createdAt: minutesAgo(now, 60 * 22), unread: false },
    ],
  }
}
