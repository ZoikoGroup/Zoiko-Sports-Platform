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
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  preparing: 'Preparing',
  ready: 'Ready',
  'in-progress': 'In Progress',
}

const integer = new Intl.NumberFormat('en-US')
export const formatCount = (value: number) => integer.format(value)

/**
 * "Nov 18 – 20, 2026" / "Nov 28 – Dec 2, 2026": an event's dates in its own time
 * zone, as organizers plan it. A one-day event shows a single date.
 */
export function formatEventRange(startIso: string, endIso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' })
  const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' })
  const start = new Date(startIso)
  const end = new Date(endIso)
  const first = day.format(start)
  const last = day.format(end)
  const startYear = year.format(start)
  const endYear = year.format(end)
  if (first === last && startYear === endYear) return `${first}, ${endYear}`
  if (startYear !== endYear) return `${first}, ${startYear} – ${last}, ${endYear}`
  const [startMonth] = first.split(' ')
  const [endMonth, endDay] = last.split(' ')
  return startMonth === endMonth ? `${first} – ${endDay}, ${endYear}` : `${first} – ${last}, ${endYear}`
}

/** "Now", "10 min ago", "2h ago", "3d ago" — compact elapsed time for activity lists. */
export function formatAgo(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** "2026-06" → "Jun" (or "Jun 2026" with `withYear`). */
export function formatMonth(month: string, withYear = false): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', withYear ? { month: 'long', year: 'numeric' } : { month: 'short' })
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
