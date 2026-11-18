/**
 * Static demo data for Competitions & Events, in the shape the API will return
 * (types.ts). The competitions are the Overview's upcoming events (same ids,
 * cities and dates), so the two pages agree. All names are fictional.
 */
import { at, minutesAgo } from './mockTime'
import type { Competition, CompetitionEventStatus, CompetitionsData, CompetitionStatus, CountryCode, RegionId, SportId } from './types'

interface Seed {
  id: string
  name: string
  sport: SportId
  country: CountryCode
  region: RegionId
  city: string
  timeZone: string
  from: number
  days: number
  status: CompetitionStatus
  organizations: number
  venue: string
  /** One status per event, in date order. */
  events: CompetitionEventStatus[]
}

const SEEDS: Seed[] = [
  { id: 'evt-nafs', name: 'North America Pro Football Showcase', sport: 'football', country: 'US', region: 'north-america', city: 'Los Angeles', timeZone: 'America/Los_Angeles', from: 4, days: 2, status: 'active', organizations: 12, venue: 'Harbor Field', events: ['confirmed', 'confirmed', 'confirmed', 'confirmed'] },
  { id: 'evt-gbs', name: 'Global Basketball Series', sport: 'basketball', country: 'JP', region: 'asia', city: 'Tokyo', timeZone: 'Asia/Tokyo', from: 9, days: 3, status: 'scheduled', organizations: 16, venue: 'Bayside Arena', events: ['confirmed', 'confirmed', 'confirmed', 'confirmed'] },
  { id: 'evt-wcq', name: 'World Cricket Qualifier', sport: 'cricket', country: 'IN', region: 'asia', city: 'Mumbai', timeZone: 'Asia/Kolkata', from: 18, days: 7, status: 'preparing', organizations: 10, venue: 'Marine Drive Oval', events: ['confirmed', 'confirmed', 'confirmed', 'planning'] },
  { id: 'evt-apto', name: 'Asia-Pacific Tennis Open', sport: 'tennis', country: 'AU', region: 'oceania', city: 'Sydney', timeZone: 'Australia/Sydney', from: 26, days: 5, status: 'scheduled', organizations: 24, venue: 'Harbourside Courts', events: ['confirmed', 'confirmed', 'confirmed', 'confirmed'] },
  { id: 'evt-ecsc', name: 'European Club Soccer Cup', sport: 'soccer', country: 'ES', region: 'europe', city: 'Madrid', timeZone: 'Europe/Madrid', from: 34, days: 4, status: 'scheduled', organizations: 8, venue: 'Estadio Central', events: ['confirmed', 'confirmed', 'confirmed'] },
  { id: 'evt-ccbc', name: 'Continental Basketball Cup', sport: 'basketball', country: 'NG', region: 'africa', city: 'Lagos', timeZone: 'Africa/Lagos', from: 41, days: 3, status: 'preparing', organizations: 8, venue: 'Lagoon Dome', events: ['confirmed', 'confirmed', 'planning'] },
  { id: 'evt-casi', name: 'Copa Andina Soccer Invitational', sport: 'soccer', country: 'AR', region: 'south-america', city: 'Buenos Aires', timeZone: 'America/Argentina/Buenos_Aires', from: 52, days: 6, status: 'draft', organizations: 6, venue: 'Estadio del Río', events: ['confirmed', 'planning', 'draft'] },
  { id: 'evt-nihc', name: 'Northern Ice Hockey Cup', sport: 'ice-hockey', country: 'CA', region: 'north-america', city: 'Toronto', timeZone: 'America/Toronto', from: 63, days: 4, status: 'scheduled', organizations: 10, venue: 'Lakeshore Ice Centre', events: ['confirmed', 'confirmed', 'confirmed'] },
]

const ROUND_NAMES = ['Opening Round', 'Group Stage', 'Semi-finals', 'Final']

function competition(now: Date, seed: Seed, index: number): Competition {
  const { events, from, days, venue, ...rest } = seed
  return {
    ...rest,
    startsAt: at(now, from, 10, 0, seed.timeZone),
    endsAt: at(now, from + days, 21, 0, seed.timeZone),
    events: events.map((status, i) => ({
      id: `${seed.id}-e${i + 1}`,
      name: ROUND_NAMES[i + (ROUND_NAMES.length - events.length)] ?? `Round ${i + 1}`,
      venue,
      startsAt: at(now, from + Math.round((days * i) / Math.max(events.length - 1, 1)), 18, 0, seed.timeZone),
      status,
    })),
    history: [
      { id: `${seed.id}-h3`, at: minutesAgo(now, 60 * (3 + index)), actor: 'Jordan Ortiz', summary: seed.status === 'draft' ? 'Draft updated' : 'Schedule published' },
      { id: `${seed.id}-h2`, at: minutesAgo(now, 60 * 24 * (2 + index)), actor: 'Riya Kapoor', summary: `Venue confirmed – ${venue}` },
      { id: `${seed.id}-h1`, at: minutesAgo(now, 60 * 24 * (9 + index)), actor: 'Maria Ruiz', summary: 'Competition created' },
    ],
  }
}

export function buildMockCompetitions(now = new Date()): CompetitionsData {
  return {
    generatedAt: now.toISOString(),
    hero: {
      eyebrow: 'Competitions & Events',
      title: 'Competitions & Events',
      subtitle: 'Manage your competitions and events across regions and sports.',
    },
    activeCompetitions: 142,
    competitions: SEEDS.map((seed, i) => competition(now, seed, i)),
    attention: [
      { id: 'at-1', kind: 'schedule', count: 2, title: '2 schedules awaiting review', detail: 'Fixture updates require your approval.', cta: 'Review', module: 'fixtures' },
      { id: 'at-2', kind: 'venue', count: 3, title: '3 venue readiness submissions', detail: 'Venue details and compliance for review.', cta: 'Review', module: 'venues' },
      { id: 'at-3', kind: 'participation', count: 1, title: '1 participation request', detail: 'New organization request to join.', cta: 'View Request', module: 'participants' },
    ],
    updates: [
      { id: 'cu-1', summary: 'Global Basketball Series', subject: 'schedule published', at: minutesAgo(now, 32) },
      { id: 'cu-2', summary: 'Asia-Pacific Tennis Open', subject: 'venue confirmed', at: minutesAgo(now, 64) },
    ],
  }
}
