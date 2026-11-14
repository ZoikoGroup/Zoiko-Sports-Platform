/**
 * Static demo data for the Organizer Overview, in the exact shape the API will
 * return (types.ts). Dates are placed relative to "now" so the dashboard always
 * looks current: upcoming events stay upcoming and "Today" stays today.
 * Every name here is fictional.
 */
import { zonedTimeToUtc } from '../format'
import type { DecisionUpdate, OrganizerOverview, UpcomingEvent } from './types'

/** An event `daysAhead` days from now at a local wall time in its own zone. */
function at(now: Date, daysAhead: number, hour: number, minute: number, timeZone: string): string {
  const day = new Date(now.getTime() + daysAhead * 86_400_000)
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(day)
    .split('-')
    .map(Number)
  return zonedTimeToUtc(y, m - 1, d, hour, minute, timeZone).toISOString()
}

/** Started on the hour before now, so it is genuinely under way. */
function startedRecently(now: Date): string {
  const start = new Date(now.getTime() - 90 * 60_000)
  start.setUTCMinutes(0, 0, 0)
  return start.toISOString()
}

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

export function buildMockOverview(now = new Date()): OrganizerOverview {
  const upcomingEvents: UpcomingEvent[] = [
    {
      id: 'evt-nafs',
      name: 'North America Pro Football Showcase',
      sport: 'football',
      region: 'north-america',
      city: 'Los Angeles',
      country: 'United States',
      startsAt: at(now, 2, 19, 0, 'America/Los_Angeles'),
      timeZone: 'America/Los_Angeles',
      status: 'ready',
    },
    {
      id: 'evt-gbs',
      name: 'Global Basketball Series',
      sport: 'basketball',
      region: 'asia',
      city: 'Tokyo',
      country: 'Japan',
      startsAt: startedRecently(now),
      timeZone: 'Asia/Tokyo',
      status: 'in-progress',
    },
    {
      id: 'evt-wcq',
      name: 'World Cricket Qualifier',
      sport: 'cricket',
      region: 'asia',
      city: 'Mumbai',
      country: 'India',
      startsAt: at(now, 4, 18, 30, 'Asia/Kolkata'),
      timeZone: 'Asia/Kolkata',
      status: 'preparing',
    },
    {
      id: 'evt-apto',
      name: 'Asia-Pacific Tennis Open',
      sport: 'tennis',
      region: 'oceania',
      city: 'Sydney',
      country: 'Australia',
      startsAt: at(now, 9, 11, 0, 'Australia/Sydney'),
      timeZone: 'Australia/Sydney',
      status: 'scheduled',
    },
    {
      id: 'evt-ecsc',
      name: 'European Club Soccer Cup',
      sport: 'soccer',
      region: 'europe',
      city: 'Madrid',
      country: 'Spain',
      startsAt: at(now, 12, 20, 0, 'Europe/Madrid'),
      timeZone: 'Europe/Madrid',
      status: 'scheduled',
    },
    {
      id: 'evt-ccbc',
      name: 'Continental Basketball Cup',
      sport: 'basketball',
      region: 'africa',
      city: 'Lagos',
      country: 'Nigeria',
      startsAt: at(now, 18, 17, 0, 'Africa/Lagos'),
      timeZone: 'Africa/Lagos',
      status: 'preparing',
    },
    {
      id: 'evt-casi',
      name: 'Copa Andina Soccer Invitational',
      sport: 'soccer',
      region: 'south-america',
      city: 'Buenos Aires',
      country: 'Argentina',
      startsAt: at(now, 26, 21, 0, 'America/Argentina/Buenos_Aires'),
      timeZone: 'America/Argentina/Buenos_Aires',
      status: 'scheduled',
    },
    {
      id: 'evt-nihc',
      name: 'Northern Ice Hockey Cup',
      sport: 'ice-hockey',
      region: 'north-america',
      city: 'Toronto',
      country: 'Canada',
      startsAt: at(now, 47, 19, 30, 'America/Toronto'),
      timeZone: 'America/Toronto',
      status: 'scheduled',
    },
  ]

  const recentDecisions: DecisionUpdate[] = [
    { id: 'dec-1', summary: 'Schedule updates approved', subject: 'Global Basketball Series', decidedAt: minutesAgo(now, 38) },
    { id: 'dec-2', summary: 'Venue readiness confirmed', subject: 'Sydney, Asia-Pacific Tennis Open', decidedAt: minutesAgo(now, 65) },
    { id: 'dec-3', summary: 'Team registrations approved', subject: 'World Cricket Qualifier', decidedAt: minutesAgo(now, 101) },
    { id: 'dec-4', summary: 'Officials assigned', subject: 'North America Pro Football Showcase', decidedAt: minutesAgo(now, 26 * 60) },
  ]

  return {
    generatedAt: now.toISOString(),
    hero: {
      title: 'Global Competition Operations',
      subtitle: 'Plan, manage and deliver world-class sporting events across markets and time zones.',
    },
    kpis: [
      { id: 'active-competitions', label: 'Active Competitions', value: 142, change: { percent: 12, comparedTo: 'prior 30 days' } },
      { id: 'live-events', label: 'Live Events', value: 18, change: { percent: 8, comparedTo: 'prior 30 days' } },
      { id: 'participating-organizations', label: 'Participating Organizations', value: 2847, change: { percent: 8, comparedTo: 'prior 30 days' } },
      { id: 'countries-regions', label: 'Countries / Regions', value: 196 },
    ],
    upcomingEvents,
    participation: [
      { region: 'north-america', percent: 27 },
      { region: 'south-america', percent: 10 },
      { region: 'europe', percent: 24 },
      { region: 'africa', percent: 7 },
      { region: 'asia', percent: 27 },
      { region: 'oceania', percent: 5 },
    ],
    recentDecisions,
    actionCenter: { open: 6 },
    notifications: [
      { id: 'n-1', title: 'Fixture change needs approval', detail: 'European Club Soccer Cup · kick-off moved to 20:00', createdAt: minutesAgo(now, 12), unread: true },
      { id: 'n-2', title: 'Venue checklist overdue', detail: 'Continental Basketball Cup · 2 checks open', createdAt: minutesAgo(now, 47), unread: true },
      { id: 'n-3', title: 'New registration request', detail: 'Copa Andina Soccer Invitational · 3 clubs', createdAt: minutesAgo(now, 140), unread: true },
      { id: 'n-4', title: 'Schedule published', detail: 'Asia-Pacific Tennis Open · version 2', createdAt: minutesAgo(now, 60 * 22), unread: false },
    ],
  }
}
