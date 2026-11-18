/**
 * Static demo data for the Action Center, in the shape the API will return
 * (types.ts). Times are relative to "now" so due dates and "2h ago" stay
 * current. Event names match the Overview demo data; all names are fictional.
 */
import type { ActionCenterData, ActionItem, ActionPriority } from './types'

const hoursFromNow = (now: Date, hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

const RANK: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 }

export function buildMockActionCenter(now = new Date()): ActionCenterData {
  const queue: ActionItem[] = [
    { id: 'ac-1', title: 'Approve venue readiness', context: 'Global Basketball Series – Toronto', kind: 'schedule', priority: 'high', dueAt: hoursFromNow(now, 6), module: 'venues' },
    { id: 'ac-2', title: 'Confirm team registrations', context: 'Asia-Pacific Tennis Open', kind: 'registration', priority: 'high', dueAt: hoursFromNow(now, 20), module: 'participants' },
    { id: 'ac-3', title: 'Review event schedule update', context: 'World Cricket Qualifier', kind: 'review', priority: 'medium', dueAt: hoursFromNow(now, 30), module: 'fixtures' },
    { id: 'ac-4', title: 'Approve sponsorship asset', context: 'North America Football Showcase', kind: 'document', priority: 'medium', dueAt: hoursFromNow(now, 44), module: 'sponsorships' },
    { id: 'ac-5', title: 'Resolve venue capacity change', context: 'Global Athletics Meet', kind: 'venue', priority: 'low', dueAt: hoursFromNow(now, 70), module: 'venues' },
    { id: 'ac-6', title: 'Sign off officials roster', context: 'European Club Soccer Cup', kind: 'registration', priority: 'high', dueAt: hoursFromNow(now, 26), module: 'participants' },
    { id: 'ac-7', title: 'Approve broadcast schedule', context: 'Global Basketball Series', kind: 'schedule', priority: 'medium', dueAt: hoursFromNow(now, 52), module: 'fixtures' },
    { id: 'ac-8', title: 'Review medical cover plan', context: 'Continental Basketball Cup – Lagos', kind: 'review', priority: 'medium', dueAt: hoursFromNow(now, 60), module: 'event-day' },
    { id: 'ac-9', title: 'Verify eligibility documents', context: 'Copa Andina Soccer Invitational', kind: 'document', priority: 'low', dueAt: hoursFromNow(now, 96), module: 'participants' },
    { id: 'ac-10', title: 'Confirm accreditation zones', context: 'North America Pro Football Showcase', kind: 'venue', priority: 'low', dueAt: hoursFromNow(now, 110), module: 'venues' },
    { id: 'ac-11', title: 'Publish fixture list', context: 'Northern Ice Hockey Cup', kind: 'schedule', priority: 'low', dueAt: hoursFromNow(now, 140), module: 'fixtures' },
    { id: 'ac-12', title: 'Approve press release', context: 'Asia-Pacific Tennis Open', kind: 'document', priority: 'low', dueAt: hoursFromNow(now, 160), module: 'communications' },
  ]
  // The five shown first match the design; the rest follow by priority, then due time.
  const ordered = [
    ...queue.slice(0, 5),
    ...queue.slice(5).sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.dueAt.localeCompare(b.dueAt)),
  ]

  return {
    generatedAt: now.toISOString(),
    hero: { title: 'Action Center', subtitle: 'Your operational hub for tasks, approvals and time-critical actions.' },
    summary: { actions: 12, approvals: 28, deadlines: 6, alerts: 3 },
    queue: ordered,
    approvals: [
      { id: 'ap-1', kind: 'registration', title: 'Team Registration', scope: '8 organizations', pending: 5, module: 'participants' },
      { id: 'ap-2', kind: 'venue', title: 'Venue Readiness', scope: '3 venues', pending: 3, module: 'venues' },
      { id: 'ap-3', kind: 'fixture', title: 'Fixture Changes', scope: '4 requests', pending: 2, module: 'fixtures' },
      { id: 'ap-4', kind: 'document', title: 'Event Documents', scope: '7 submissions', pending: 7, module: 'content' },
      { id: 'ap-5', kind: 'sponsorship', title: 'Sponsorships', scope: '3 agreements', pending: 3, module: 'sponsorships' },
      { id: 'ap-6', kind: 'media', title: 'Media Accreditation', scope: '5 applicants', pending: 5, module: 'communications' },
      { id: 'ap-7', kind: 'officials', title: 'Officials Assignments', scope: '3 events', pending: 3, module: 'event-day' },
    ],
    alerts: [
      { id: 'al-1', severity: 'critical', title: 'Venue readiness pending – 3 events', createdAt: minutesAgo(now, 0) },
      { id: 'al-2', severity: 'warning', title: 'Registration approvals – 12 organizations', createdAt: minutesAgo(now, 120) },
      { id: 'al-3', severity: 'warning', title: 'Schedule conflict – Event #64582', createdAt: minutesAgo(now, 240) },
    ],
    deadlines: [
      { id: 'dl-1', title: 'Final team registrations – Basketball Series', dueAt: hoursFromNow(now, 8), module: 'participants' },
      { id: 'dl-2', title: 'Venue confirmation – Football Showcase', dueAt: hoursFromNow(now, 50), module: 'venues' },
      { id: 'dl-3', title: 'Fixture lock – Global Basketball Series', dueAt: hoursFromNow(now, 194), module: 'fixtures' },
      { id: 'dl-4', title: 'Sponsor asset delivery – Tennis Open', dueAt: hoursFromNow(now, 236), module: 'sponsorships' },
      { id: 'dl-5', title: 'Officials roster – European Club Soccer Cup', dueAt: hoursFromNow(now, 290), module: 'event-day' },
      { id: 'dl-6', title: 'Broadcast plan – World Cricket Qualifier', dueAt: hoursFromNow(now, 340), module: 'communications' },
    ],
  }
}
