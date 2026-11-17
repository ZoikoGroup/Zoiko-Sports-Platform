import {
  CalendarDays,
  ChartColumn,
  CircleHelp,
  Clapperboard,
  ClipboardCheck,
  Handshake,
  House,
  Layers,
  LayoutGrid,
  MapPin,
  Megaphone,
  Settings,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  Zap,
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
  /** Another role's workspace rather than an organizer module. */
  workspace?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

/** Sidebar sections, in the order of the Organizer Overview design. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Core Workspace',
    items: [
      { slug: 'overview', label: 'Overview', icon: House, description: 'Your competition operations at a glance.' },
      { slug: 'action-center', label: 'Action Center', icon: Zap, badge: 'actionCenter', description: 'Approvals, overdue checks and follow-ups that need you, with an owner and due time for each.' },
    ],
  },
  {
    title: 'Competition Operations',
    items: [
      { slug: 'competitions', label: 'Competitions & Events', icon: LayoutGrid, description: 'Create competitions and events and move them through their lifecycle.' },
      { slug: 'fixtures', label: 'Fixtures & Schedule', icon: CalendarDays, description: 'Build fixtures, propose schedule changes, approve and publish versions.' },
      { slug: 'venues', label: 'Venues & Readiness', icon: StadiumIcon, description: 'Track venue readiness checks shared by each venue before event day.' },
      { slug: 'event-day', label: 'Event-Day Coordination', icon: ClipboardCheck, description: 'Live timeline, exceptions and decisions while an event is running.' },
    ],
  },
  {
    title: 'Management & Oversight',
    items: [
      { slug: 'participants', label: 'Participating Organizations', icon: UsersRound, description: 'Invite organizations, review registrations and manage participation.' },
      { slug: 'reports', label: 'Reports & Analytics', icon: ChartColumn, description: 'Operational reports, audit history and exports.' },
      { slug: 'team-access', label: 'Team & Access', icon: UserCog, description: "Your organization's members, their roles and pending invitations." },
    ],
  },
  {
    title: 'Engagement & Services',
    items: [
      { slug: 'content', label: 'Content & Resources', icon: Layers, description: 'Documents, guides and media shared with participants.' },
      { slug: 'communications', label: 'Communications', icon: Megaphone, description: 'Send notices to participants and track delivery and acknowledgment.' },
      { slug: 'sponsorships', label: 'Sponsorships & Partners', icon: Handshake, description: 'Sponsors, partners and their commitments for each competition.' },
    ],
  },
  {
    title: 'Settings & Configuration',
    items: [{ slug: 'settings', label: 'Settings', icon: Settings, description: 'Organization profile, preferences and notification settings.' }],
  },
]

/**
 * Pages that are not in the sidebar but stay reachable: from the top bar (Help),
 * from search, and from existing links, so no address breaks.
 */
export const OTHER_ITEMS: NavItem[] = [
  { slug: 'help', label: 'Help & Support', icon: CircleHelp, description: 'Guides, contact options and service status.' },
  { slug: 'results', label: 'Results & Standings', icon: Trophy, description: 'Record results and publish standings and tables.' },
  { slug: 'compliance', label: 'Compliance & Eligibility', icon: ShieldCheck, description: 'Eligibility rules, documents and compliance checks for participants.' },
  { slug: 'media', label: 'Media & Content', icon: Clapperboard, description: 'Manage photos, videos and published content for your events.' },
  { slug: 'sports-hub', label: 'Sports Hub', icon: Layers, description: 'Sport formats, rules and reference data used across competitions.' },
  { slug: 'venue-operations', label: 'Venue Operations', icon: MapPin, workspace: true, description: 'The venue operator experience: readiness checks, gates and event-day operations.' },
  { slug: 'club-team', label: 'Club & Team', icon: Users, workspace: true, description: 'The club experience: fixtures, team sheets, notices and delegated tasks.' },
  { slug: 'internal-administration', label: 'Internal Administration', icon: ShieldCheck, workspace: true, description: 'Platform administration for Zoiko Sports staff.' },
]

export const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...OTHER_ITEMS]

export const findNavItem = (slug: string | undefined) => ALL_ITEMS.find((item) => item.slug === slug)

export const organizerPath = (slug: string) => `${ORGANIZER_BASE}/${slug}`
