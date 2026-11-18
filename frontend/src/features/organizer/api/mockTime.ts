/** Time helpers for the demo data: everything is placed relative to "now". */
import { zonedTimeToUtc } from '../format'

/** `daysAhead` days from now at a local wall time in the event's zone. */
export function at(now: Date, daysAhead: number, hour: number, minute: number, timeZone: string): string {
  const day = new Date(now.getTime() + daysAhead * 86_400_000)
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(day)
    .split('-')
    .map(Number)
  return zonedTimeToUtc(y, m - 1, d, hour, minute, timeZone).toISOString()
}

export const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()
