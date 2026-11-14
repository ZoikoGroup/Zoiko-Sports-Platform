import { CalendarPlus, ChartNoAxesColumnIncreasing, UserPlus, UsersRound, Zap, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { StadiumIcon } from '../../../components/icons'
import { organizerPath } from '../navigation'

interface QuickAction {
  label: string
  to: string
  icon: LucideIcon | ComponentType<{ size?: number; strokeWidth?: number }>
  tone: 'blue' | 'violet' | 'green' | 'orange' | 'sky'
}

const ACTIONS: QuickAction[] = [
  { label: 'Create Event', to: `${organizerPath('competitions')}?new=event`, icon: CalendarPlus, tone: 'blue' },
  { label: 'Register Organization', to: `${organizerPath('participants')}?new=organization`, icon: UserPlus, tone: 'violet' },
  { label: 'Manage Venues', to: organizerPath('venues'), icon: StadiumIcon, tone: 'green' },
  { label: 'Manage Teams', to: organizerPath('participants'), icon: UsersRound, tone: 'orange' },
  { label: 'View Reports', to: organizerPath('reports'), icon: ChartNoAxesColumnIncreasing, tone: 'sky' },
]

export function QuickActions() {
  return (
    <section className="org-card org-quick" aria-labelledby="org-quick-title">
      <h2 id="org-quick-title" className="org-card__title org-quick__title">
        <Zap size={30} aria-hidden="true" />
        Quick Actions
      </h2>
      <ul className="org-quick__list">
        {ACTIONS.map(({ label, to, icon: Icon, tone }) => (
          <li key={label}>
            <Link className={`org-quick__action org-quick__action--${tone}`} to={to}>
              <Icon size={40} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
