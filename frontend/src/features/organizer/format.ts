import type { EventStatus, RegionId, SportId } from './api/types'

export const SPORT_LABELS: Record<SportId, string> = {
  football: 'Football',
  basketball: 'Basketball',
  cricket: 'Cricket',
  tennis: 'Tennis',
  soccer: 'Soccer',
  baseball: 'Baseball',
  'ice-hockey': 'Ice Hockey',
}

export const REGION_LABELS: Record<RegionId, string> = {
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  ready: 'Ready',
  'in-progress': 'In Progress',
  preparing: 'Preparing',
  scheduled: 'Scheduled',
}

const integer = new Intl.NumberFormat('en-US')
export const formatCount = (value: number) => integer.format(value)

/**
 * Short zone name for an instant ("PST", "JST", "IST", "AEDT"). en-US only knows
 * American abbreviations, so other locales are tried for zones it renders as
 * "GMT+x"; the offset form is kept if none has a common abbreviation.
 */
const ZONE_LOCALES = ['en-US', 'en-AU', 'en-IN', 'en-GB', 'ja-JP']
export function zoneAbbreviation(date: Date, timeZone: string): string {
  let fallback = ''
  for (const locale of ZONE_LOCALES) {
    const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value
    if (!name) continue
    if (/^[A-Z]{2,5}$/.test(name)) return name
    fallback ||= name
  }
  return fallback
}

/**
 * { date: "Nov 8,", time: "7:00 PM PST" }: the event's local wall time, as
 * organizers plan it, split so a narrow column wraps between date and time.
 */
export function formatEventStart(iso: string, timeZone: string): { date: string; time: string } {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(date)
  return { date: `${day},`, time: `${time} ${zoneAbbreviation(date, timeZone)}` }
}

const dayKey = (date: Date) => date.toLocaleDateString('en-CA')

/** "Today, 10:24 AM" / "Yesterday, 4:02 PM" / "Nov 9, 4:02 PM" in the viewer's zone. */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(now)) return `Today, ${time}`
  if (dayKey(date) === dayKey(yesterday)) return `Yesterday, ${time}`
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

/**
 * The UTC instant at which a wall-clock time occurs in a zone. Used by the mock
 * data to place events at sensible local times; the real API sends instants.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month, day, hour, minute)
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(new Date(instant))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - instant
  }
  const first = guess - offsetAt(guess)
  return new Date(guess - offsetAt(first))
}

/** Uppercase initials from a display name or email ("Olivia Organizer" → "OO"). */
export function initials(name: string): string {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
}

/** "competition_director" → "Competition Director". */
export const humanizeRole = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
