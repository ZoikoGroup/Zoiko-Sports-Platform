import {
  Bell,
  CalendarDays,
  ChartColumn,
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  Clapperboard,
  House,
  Layers,
  MapPin,
  Megaphone,
  Network,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { StadiumIcon } from '../../components/icons'

export const ORGANIZER_BASE = '/organizer'

type Icon = LucideIcon | ComponentType<{ size?: number; className?: string }>

export interface NavItem {
  /** Route segment under /organizer. */
  slug: string
  label: string
  icon: Icon
  /** What the module will do — shown on its page until it is built. */
  description: string
  /** Key into live counts (rendered as a badge). */
  badge?: 'actionCenter'
  /** Accent tile for the additional workspaces. */
  accent?: 'violet' | 'green' | 'orange'
}

/** Organizer Workspace modules (01–13), in sidebar order. */
export const WORKSPACE_ITEMS: NavItem[] = [
  { slug: 'overview', label: 'Overview', icon: House, description: 'Your competition operations at a glance.' },
  { slug: 'action-center', label: 'Action Center', icon: Bell, badge: 'actionCenter', description: 'Approvals, overdue checks and follow-ups that need you, with an owner and due time for each.' },
  { slug: 'competitions', label: 'Competitions & Events', icon: Trophy, description: 'Create competitions and events and move them through their lifecycle.' },
  { slug: 'fixtures', label: 'Fixtures & Schedule', icon: CalendarDays, description: 'Build fixtures, propose schedule changes, approve and publish versions.' },
  { slug: 'venues', label: 'Venues & Readiness', icon: StadiumIcon, description: 'Track venue readiness checks shared by each venue before event day.' },
  { slug: 'event-day', label: 'Event-Day Coordination', icon: Network, description: 'Live timeline, exceptions and decisions while an event is running.' },
  { slug: 'results', label: 'Results & Standings', icon: ChartColumn, description: 'Record results and publish standings and tables.' },
  { slug: 'participants', label: 'Participants & Registrations', icon: Users, description: 'Invite organizations, review registrations and manage participation.' },
  { slug: 'compliance', label: 'Compliance & Eligibility', icon: ShieldCheck, description: 'Eligibility rules, documents and compliance checks for participants.' },
  { slug: 'communications', label: 'Communications', icon: Megaphone, description: 'Send notices to participants and track delivery and acknowledgment.' },
  { slug: 'media', label: 'Media & Content', icon: Clapperboard, description: 'Manage photos, videos and published content for your events.' },
  { slug: 'sports-hub', label: 'Sports Hub', icon: Layers, description: 'Sport formats, rules and reference data used across competitions.' },
  { slug: 'reports', label: 'Reports & Analytics', icon: ChartNoAxesColumnIncreasing, description: 'Operational reports, audit history and exports.' },
]

/** Other role workspaces (14–16), opened from the organizer sidebar. */
export const ADDITIONAL_WORKSPACES: NavItem[] = [
  { slug: 'venue-operations', label: 'Venue Operations', icon: MapPin, accent: 'violet', description: 'The venue operator experience: readiness checks, gates and event-day operations.' },
  { slug: 'club-team', label: 'Club & Team', icon: Users, accent: 'green', description: 'The club experience: fixtures, team sheets, notices and delegated tasks.' },
  { slug: 'internal-administration', label: 'Internal Administration', icon: ShieldCheck, accent: 'orange', description: 'Platform administration for Zoiko Sports staff.' },
]

export const UTILITY_ITEMS: NavItem[] = [
  { slug: 'settings', label: 'Settings', icon: Settings, description: 'Organization profile, preferences and notification settings.' },
  { slug: 'help', label: 'Help & Support', icon: CircleHelp, description: 'Guides, contact options and service status.' },
]

const ALL_ITEMS = [...WORKSPACE_ITEMS, ...ADDITIONAL_WORKSPACES, ...UTILITY_ITEMS]

export const findNavItem = (slug: string | undefined) => ALL_ITEMS.find((item) => item.slug === slug)

/** Two-digit number shown before each numbered item ("01."). */
export function itemNumber(item: NavItem): string | null {
  const index = [...WORKSPACE_ITEMS, ...ADDITIONAL_WORKSPACES].indexOf(item)
  return index === -1 ? null : String(index + 1).padStart(2, '0')
}

export const organizerPath = (slug: string) => `${ORGANIZER_BASE}/${slug}`
