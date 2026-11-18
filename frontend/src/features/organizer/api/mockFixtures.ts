/**
 * Static demo data for Fixtures & Schedule, in the shape the API will return
 * (types.ts). Fixtures fall inside the Competitions & Events demo competitions
 * (same ids and date windows), so the pages agree. All names are fictional.
 */
import { localDay } from '../format'
import { at, minutesAgo } from './mockTime'
import type { CountryCode, Fixture, FixtureRecipient, FixturesData, RegionId, SportId } from './types'

interface CompetitionSeed {
  id: string
  name: string
  sport: SportId
  city: string
  country: CountryCode
  region: RegionId
  timeZone: string
  venue: string
  /** First day of the competition, in days from now. */
  from: number
}

const COMPETITIONS: Record<string, CompetitionSeed> = {
  nafs: { id: 'evt-nafs', name: 'North America Pro Football Showcase', sport: 'football', city: 'Los Angeles', country: 'US', region: 'north-america', timeZone: 'America/Los_Angeles', venue: 'Harbor Field', from: 4 },
  gbs: { id: 'evt-gbs', name: 'Global Basketball Series', sport: 'basketball', city: 'Tokyo', country: 'JP', region: 'asia', timeZone: 'Asia/Tokyo', venue: 'Bayside Arena', from: 9 },
  wcq: { id: 'evt-wcq', name: 'World Cricket Qualifier', sport: 'cricket', city: 'Mumbai', country: 'IN', region: 'asia', timeZone: 'Asia/Kolkata', venue: 'Marine Drive Oval', from: 18 },
  apto: { id: 'evt-apto', name: 'Asia-Pacific Tennis Open', sport: 'tennis', city: 'Sydney', country: 'AU', region: 'oceania', timeZone: 'Australia/Sydney', venue: 'Harbourside Courts', from: 26 },
  ecsc: { id: 'evt-ecsc', name: 'European Club Soccer Cup', sport: 'soccer', city: 'Madrid', country: 'ES', region: 'europe', timeZone: 'Europe/Madrid', venue: 'Estadio Central', from: 34 },
  ccbc: { id: 'evt-ccbc', name: 'Continental Basketball Cup', sport: 'basketball', city: 'Lagos', country: 'NG', region: 'africa', timeZone: 'Africa/Lagos', venue: 'Lagoon Dome', from: 41 },
}

interface FixtureSeed {
  id: string
  comp: keyof typeof COMPETITIONS
  home: string
  away: string
  day: number
  hour: number
  minute?: number
  key?: boolean
  conflict?: string
  /** An earlier published version: hours earlier than the current time. */
  movedFromHour?: number
  change?: { hour: number; minute?: number; dayShift?: number; reason: string; state: 'proposed' | 'awaiting-approval' }
}

const SEEDS: FixtureSeed[] = [
  { id: 'fx-101', comp: 'nafs', home: 'Riverside Hawks', away: 'Lakeside Titans', day: 0, hour: 19, key: true, movedFromHour: 18 },
  { id: 'fx-102', comp: 'nafs', home: 'Harbor Kings', away: 'Desert Suns', day: 1, hour: 17 },
  { id: 'fx-103', comp: 'nafs', home: 'Bay Rangers', away: 'Summit Bears', day: 2, hour: 18, minute: 30, change: { hour: 20, reason: 'Broadcast slot moved by the rights holder.', state: 'awaiting-approval' } },
  { id: 'fx-201', comp: 'gbs', home: 'Metro Kings', away: 'Coastal Panthers', day: 0, hour: 18 },
  { id: 'fx-202', comp: 'gbs', home: 'Capital Comets', away: 'Harbour Lions', day: 1, hour: 19 },
  { id: 'fx-203', comp: 'gbs', home: 'Metro Kings', away: 'Harbour Lions', day: 3, hour: 18, key: true },
  { id: 'fx-301', comp: 'wcq', home: 'Emerald CC', away: 'Ridgeway CC', day: 0, hour: 11, change: { hour: 10, reason: 'Earlier start to avoid evening rain forecast.', state: 'proposed' } },
  { id: 'fx-302', comp: 'wcq', home: 'Northbridge CC', away: 'Saltmarsh CC', day: 2, hour: 14, conflict: 'Marine Drive Oval is also booked for a training session at this time.' },
  { id: 'fx-303', comp: 'wcq', home: 'Emerald CC', away: 'Northbridge CC', day: 7, hour: 11, key: true },
  { id: 'fx-401', comp: 'apto', home: 'Harper Lee', away: 'Naomi Park', day: 0, hour: 14, conflict: 'The assigned chair umpire is also scheduled on Court 2 at this time.' },
  { id: 'fx-402', comp: 'apto', home: 'Ava Collins', away: 'Mia Tanaka', day: 2, hour: 13 },
  { id: 'fx-501', comp: 'ecsc', home: 'Costa Verde FC', away: 'Riviera United', day: 0, hour: 17 },
  { id: 'fx-601', comp: 'ccbc', home: 'Lagos Lions', away: 'Accra Stars', day: 0, hour: 17 },
]

function recipients(c: CompetitionSeed, s: FixtureSeed): FixtureRecipient[] {
  return [
    { role: 'Home club', name: s.home },
    { role: 'Away club', name: s.away },
    { role: 'Venue', name: `${c.venue}, ${c.city}` },
    { role: 'Officials', name: 'Assigned match officials (3)' },
  ]
}

function fixture(now: Date, s: FixtureSeed, index: number): Fixture {
  const c = COMPETITIONS[s.comp]
  const day = c.from + s.day
  const startsAt = at(now, day, s.hour, s.minute ?? 0, c.timeZone)
  const publishedAt = minutesAgo(now, 60 * 24 * (6 + (index % 5)))
  const revisions = s.movedFromHour
    ? [
        { version: 2, startsAt, venue: c.venue, reason: 'Kick-off moved for the evening broadcast.', author: 'Jordan Ortiz', publishedAt: minutesAgo(now, 60 * 30) },
        { version: 1, startsAt: at(now, day, s.movedFromHour, 0, c.timeZone), venue: c.venue, reason: 'Initial schedule.', author: 'Maria Ruiz', publishedAt },
      ]
    : [{ version: 1, startsAt, venue: c.venue, reason: 'Initial schedule.', author: 'Maria Ruiz', publishedAt }]
  const current = revisions[0].version
  return {
    id: s.id,
    competitionId: c.id,
    competition: c.name,
    sport: c.sport,
    home: s.home,
    away: s.away,
    city: c.city,
    country: c.country,
    region: c.region,
    timeZone: c.timeZone,
    revisions,
    change: s.change && {
      version: current + 1,
      baseVersion: current,
      startsAt: at(now, day + (s.change.dayShift ?? 0), s.change.hour, s.change.minute ?? 0, c.timeZone),
      venue: c.venue,
      reason: s.change.reason,
      author: 'Riya Kapoor',
      proposedAt: minutesAgo(now, 90 + index * 7),
      state: s.change.state,
    },
    conflict: s.conflict,
    key: s.key,
    recipients: recipients(c, s),
  }
}

export function buildMockFixtures(now = new Date()): FixturesData {
  const fixtures = SEEDS.map((s, i) => fixture(now, s, i))
  return {
    generatedAt: now.toISOString(),
    hero: {
      eyebrow: 'Customer Competition Workspace',
      title: 'Fixtures & Schedule',
      subtitle: 'Every fixture, every venue, every time zone — coordinated in one place.',
    },
    summary: { total: 312, confirmed: 276, pendingReview: 28, conflicts: 8 },
    fixtures,
    conflicts: [
      { id: 'cf-1', fixtureId: 'fx-302', kind: 'venue', title: 'Venue schedule overlap', detail: 'World Cricket Qualifier · Mumbai, India' },
      { id: 'cf-2', fixtureId: 'fx-401', kind: 'officials', title: 'Official assignment conflict', detail: 'Asia-Pacific Tennis Open · Sydney, Australia' },
    ],
    eventDays: Object.values(COMPETITIONS).map((c) => localDay(at(now, c.from, 9, 0, c.timeZone), c.timeZone)),
  }
}
